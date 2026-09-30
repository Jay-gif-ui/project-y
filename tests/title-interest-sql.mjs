// Optional PostgreSQL integration test. Install @electric-sql/pglite in a separate
// test workspace, then pass its module URL as argv[2]. Never connects to Supabase.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.argv[2] || '@electric-sql/pglite');
const db = new PGlite();
const migration = await fs.readFile(new URL('../supabase/migrations/004_title_interest.sql', import.meta.url),'utf8');
const hash = id => id.toString(16).padStart(64,'0');
const record = (country, type, id, visitor) => db.query('select public.record_title_view($1,$2,$3,$4) as result',[country,type,id,hash(visitor)]);
const ranking = async country => (await db.query('select * from public.get_country_title_interest($1)',[country])).rows;
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(migration);
  assert.equal((await record('IN','movie',100,1)).rows[0].result,'recorded');
  assert.equal((await record('IN','movie',100,1)).rows[0].result,'duplicate');
  assert.equal((await db.query('select view_count from public.title_view_hourly')).rows[0].view_count,1);
  for(let v=2;v<=10;v++) await record('IN','movie',100,v);
  for(let v=1;v<=11;v++) await record('US','movie',200,v);
  for(let v=1;v<=12;v++) await record('GB','tv',300,v);
  assert.deepEqual((await ranking('IN')).map(r=>r.title_id),[100]);
  assert.deepEqual((await ranking('US')).map(r=>r.title_id),[200]);
  assert.deepEqual((await ranking('GB')).map(r=>r.title_id),[300]);
  assert.equal((await ranking('CA')).length,0);
  // The same schema automatically supports countries not currently in the UI.
  for(let v=1;v<=10;v++) await record('NZ','movie',400,v);
  assert.equal((await ranking('NZ'))[0].title_id,400);
  console.log('PASS recording, repeat suppression, IN/US/GB isolation and generic new countries');

  await db.exec(`insert into public.title_view_hourly values
    ('US','movie',201,date_trunc('hour',now()),20),
    ('US','movie',202,date_trunc('hour',now())-interval '6 days',30),
    ('US','movie',203,date_trunc('hour',now())-interval '8 days',50000),
    ('US','movie',204,date_trunc('hour',now())+interval '1 day',50000),
    ('US','movie',205,date_trunc('hour',now()),2);`);
  let us = await ranking('US');
  assert.equal(us[0].title_id,201);
  assert.ok(!us.some(r=>[203,204,205].includes(r.title_id)));
  for(let v=1;v<=15;v++) await record('US','movie',200,1000+v);
  us = await ranking('US'); assert.equal(us[0].title_id,200);
  console.log('PASS recent weighting, expiry, future rejection, thresholds and automatically changing ranks');

  // Same numeric IDs in movie/TV remain separate, and a repeat after 30m counts.
  await db.exec("update public.title_view_receipts set viewed_at=now()-interval '31 minutes' where country_code='IN'");
  assert.equal((await record('IN','movie',100,1)).rows[0].result,'recorded');
  for(let v=1;v<=10;v++) await record('IN','tv',100,v);
  assert.deepEqual((await ranking('IN')).map(r=>r.media_type).sort(),['movie','tv']);
  for(let id=1;id<=60;id++) assert.equal((await record('CA','movie',id,99999)).rows[0].result,'recorded');
  assert.equal((await record('CA','movie',61,99999)).rows[0].result,'rate-limited');
  console.log('PASS movie/TV identity, rolling duplicate window and per-visitor rate limit');

  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role};`);
    await assert.rejects(()=>db.query('select * from public.title_view_hourly'),/permission denied/);
    await assert.rejects(()=>record('US','movie',900,4000),/permission denied/);
    await assert.rejects(()=>ranking('US'),/permission denied/);
    await db.exec('reset role;');
  }
  await db.exec('set role service_role;');
  assert.ok((await ranking('US')).length);
  assert.equal((await record('US','movie',901,4000)).rows[0].result,'recorded');
  await db.exec('reset role;');
  await db.exec("update public.title_interest_maintenance set cleaned_at=now()-interval '2 hours'; update public.title_view_receipts set viewed_at=now()-interval '2 days' where country_code='NZ'; select public.prune_title_interest();");
  assert.equal((await db.query("select count(*)::int as count from public.title_view_receipts where country_code='NZ'")).rows[0].count,0);
  assert.equal((await db.query("select count(*)::int as count from public.title_view_hourly where title_id=203")).rows[0].count,0);
  console.log('PASS private tables/RPCs, server-role access and retention cleanup');
} finally { await db.close(); }
