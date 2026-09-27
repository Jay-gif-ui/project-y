import { test } from 'node:test';
import assert from 'node:assert/strict';
import loadTypescript from './load-typescript.mjs';
const { theatricalRelease } = loadTypescript()('lib/theatrical.ts');
const now = new Date('2026-09-27T12:00:00Z');
const entry = (type, release_date) => ({ type, release_date });
const raw = (IN = [], US = [], GB = []) => ({ release_dates: { results: Object.entries({ IN, US, GB }).map(([iso_3166_1, release_dates]) => ({ iso_3166_1, release_dates })) } });

test('country theatrical dates independently distinguish past, today and upcoming', () => {
  const data = raw([entry(3,'2026-09-16T00:00:00Z')], [entry(2,'2026-09-27T00:00:00Z')], [entry(3,'2026-10-02T00:00:00Z')]);
  for (const [region, date, status] of [['IN','2026-09-16','released'],['US','2026-09-27','released'],['GB','2026-10-02','upcoming']]) {
    const result = theatricalRelease(data, region, now);
    assert.equal(result.date, date); assert.equal(result.status, status);
  }
  assert.equal(theatricalRelease(data, 'JP', now), null);
});

test('digital, premiere, physical, TV, malformed dates and worldwide metadata cannot invent theatrical status', () => {
  const data = raw([...[1,4,5,6].map(type => entry(type,'2026-09-16')), entry(3,'2026-02-30'), entry(2,'bad')]);
  data.release_date = '2026-09-16'; data.status = 'Released';
  data['watch/providers'] = {results:{IN:{flatrate:[{provider_id:8,provider_name:'Netflix'}]}}};
  assert.equal(theatricalRelease(data, 'IN', now), null);
});

test('re-releases use latest completed theatrical record; future rerelease cannot make a released title unreleased', () => {
  const data = raw([entry(3,'1992-01-01'), entry(2,'2026-09-16'), entry(3,'2026-10-02')]);
  assert.equal(theatricalRelease(data, 'in', now).date, '2026-09-16');
  assert.equal(theatricalRelease(data, 'IN', now).status, 'released');
});

test('provider and theatrical outages remain independent; TV never requests movie release dates', async () => {
  for (const fail of ['providers','release_dates',null]) {
    const calls=[];
    const service=loadTypescript({process:{env:{TMDB_API_KEY:'test-only'}},fetch:async url=>{
      calls.push(url.pathname);
      if(fail && url.pathname.endsWith(fail))return Response.json({}, {status:401});
      return Response.json(url.pathname.endsWith('release_dates') ? raw([entry(3,'2026-09-16')]).release_dates : {results:{}});
    }})('lib/tmdb.ts');
    const result=await service.getTitleAvailability('movie',1,'IN',now);
    assert.equal(result.providerError,fail==='providers');
    assert.equal(result.theatricalError,fail==='release_dates');
    if(fail!=='release_dates')assert.equal(result.theatrical.date,'2026-09-16');
    if(fail!=='providers')assert.equal(result.providers.flatrate.length,0);
    calls.length=0;
    const tv=await service.getTitleAvailability('tv',1,'GB',now);
    assert.equal(tv.theatrical,null);
    assert.ok(calls.every(path=>!path.includes('/movie/')));
  }
});
