// Opt-in real TMDB audit. No fixture responses, secrets or provider URLs are invented.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import loadTypescript from './load-typescript.mjs';
const realFetch=globalThis.fetch, cache=new Map(), queries=[];
async function auditedFetch(url,options){
  const address=String(url);
  if(!cache.has(address))cache.set(address,(async()=>{
    try{const r=await realFetch(url,options),body=await r.json(),parsed=new URL(address);
      queries.push({path:parsed.pathname,params:Object.fromEntries([...parsed.searchParams].filter(([key])=>key!=='api_key')),status:r.status});
      if(!r.ok)cache.delete(address);return {body,status:r.status};
    }catch(error){cache.delete(address);throw error;}
  })());
  const result=await cache.get(address);return Response.json(result.body,{status:result.status});
}
const load=loadTypescript({fetch:auditedFetch}),tmdb=load('lib/tmdb.ts'),releases=load('lib/tmdb-releases.ts');
const {INDIA_TRENDING}=load('data/india-trending.ts'),{releaseDates,compareReleases}=load('lib/releases.ts');
const now=new Date(),dates=releaseDates(now),key=x=>`${x.mediaType}:${x.id}`;
const report={auditedAt:now.toISOString(),network:process.env.DISCOVERY_AUDIT_DNS||'system DNS',dates,countries:[],queries};
const output=process.env.DISCOVERY_AUDIT_OUTPUT||'docs/country-discovery-live-audit.json';
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
function check(result,label){assert.ok(result.data,`${label}: ${result.error}`);assert.ok(!result.partial,`${label}: partial`);return result.data;}
async function allPages(fetchPage){const first=check(await fetchPage(1),'page 1'),items=[...first.items];for(let page=2;page<=first.totalPages;page++)items.push(...check(await fetchPage(page),`page ${page}`).items);assert.equal(items.length,first.total);assert.equal(new Set(items.map(key)).size,items.length);return {first,items};}
try{
  assert.ok(process.env.TMDB_API_KEY,'TMDB credential required');
  const movie=tmdb.getCollection('movie','trending'),tv=tmdb.getCollection('tv','trending'),trends={movie,tv};
  const globalMovies=await movie,globalTV=await tv;
  assert.ok(globalMovies.data?.length&&globalTV.data?.length,'Global feed missing');
  report.global={movies:globalMovies.data.map(key),tv:globalTV.data.map(key)};
  const fingerprints=new Set(),releaseFingerprints=new Set();
  for(const region of ['IN','US','GB','JP','KR']){
    const started=queries.length;
    const home=check(await tmdb.getCountryDiscovery(region,{surface:'home'},trends,now),region);
    const {first,items}=await allPages(page=>tmdb.getCountryDiscovery(region,{surface:'browse',page},trends,now));
    assert.deepEqual(Array.from(home.items,key),Array.from(first.items,key),'Home/See All mismatch');
    assert.ok(items.every(x=>x.releaseDate<=dates.today),'Future title in trending');
    assert.ok(items.every(x=>x.discoverySignal!=='recent-release'),'Release-only title in trending');
    if(region==='IN')assert.deepEqual(Array.from(items.slice(0,10),key),Array.from(INDIA_TRENDING.titles,x=>`${x.type}:${x.id}`),'Top 10 order');
    else assert.ok(items.every(x=>x.discoverySignal!=='india-curated'),'India curation leaked');
    for(const type of ['movie','tv']){
      const filtered=check(await tmdb.getCountryDiscovery(region,{surface:'browse',filter:type,sort:'newest'},trends,now),region+type);
      assert.ok(filtered.items.every(x=>x.mediaType===type));
      assert.deepEqual(Array.from(filtered.items,x=>x.releaseDate),Array.from(filtered.items,x=>x.releaseDate).sort().reverse());
    }
    const local=check(await tmdb.getCountryDiscovery(region,{surface:'browse',origin:'local'},trends,now),'local');
    assert.ok(local.items.every(x=>local.localIds.includes(key(x))));
    const before=queries.length;
    await tmdb.getCountryDiscovery(region,{surface:'browse'},trends,now);
    assert.equal(queries.length,before,'Warm trending reused no cache');
    const {first:releaseFirst,items:latest}=await allPages(page=>releases.getCountryReleases(region,{page},now));
    assert.ok(latest.length,region+' release selection empty');
    assert.ok(latest.every(x=>x.releaseEvent.date>=dates.recentStart&&x.releaseEvent.date<=dates.upcomingEnd));
    assert.deepEqual(latest.map(key),[...latest].sort(compareReleases).map(key));
    for(const type of ['movie','tv'])for(const status of ['released','upcoming']){
      const filtered=check(await releases.getCountryReleases(region,{filter:type,status},now),region+type+status);
      assert.ok(filtered.items.every(x=>x.mediaType===type&&x.releaseEvent.status===status));
      assert.ok(filtered.items.every(x=>status==='upcoming'?x.releaseEvent.date>dates.today:x.releaseEvent.date<=dates.today));
    }
    const releaseLocal=check(await releases.getCountryReleases(region,{origin:'local'},now),'local releases');
    assert.ok(releaseLocal.items.every(x=>x.originCountries?.includes(region)));
    const warm=queries.length;await releases.getCountryReleases(region,{},now);assert.equal(queries.length,warm);
    fingerprints.add(home.items.map(key).join(','));releaseFingerprints.add(latest.map(key).join(','));
    const entry={region,trendingTotal:items.length,home:home.items.map(x=>({key:key(x),title:x.title,signal:x.discoverySignal})),releaseTotal:releaseFirst.total,releases:latest.map(x=>({key:key(x),title:x.title,...x.releaseEvent})),providerSamples:[],uniqueRequests:queries.length-started};
    // Compare all provider groups to TMDB's actual payload for the same title in each region.
    for(const type of ['movie','tv']){
      const id=type==='movie'?664413:108978;
      const result=await tmdb.getWatchProviders(type,id,region);assert.ok(result.data);
      const url=new URL(`https://api.themoviedb.org/3/${type}/${id}/watch/providers`);url.searchParams.set('api_key',process.env.TMDB_API_KEY.trim());url.searchParams.set('include_adult','false');
      const payload=await(await auditedFetch(url)).json(),source=payload.results?.[region]??{};
      for(const group of ['flatrate','rent','buy','free','ads'])assert.deepEqual(Array.from(result.data[group],x=>x.id),(source[group]??[]).map(x=>x.provider_id));
      assert.equal(result.data.link,source.link);
      entry.providerSamples.push({type,id,groups:Object.fromEntries(['flatrate','rent','buy','free','ads'].map(group=>[group,result.data[group].map(x=>x.name)]))});
    }
    report.countries.push(entry);save();
    console.log(JSON.stringify({region,trending:items.length,releases:latest.length,upcoming:latest.filter(x=>x.releaseEvent.status==='upcoming').length,uniqueRequests:entry.uniqueRequests}));
  }
  assert.equal(fingerprints.size,5);assert.equal(releaseFingerprints.size,5);
  assert.ok(report.countries[0].home.some(x=>x.signal==='daily-trend'||x.signal==='weekly-trend'));
  report.result='passed';save();console.log('Live discovery, filters, pagination, caching and provider checks passed.');
}catch(error){report.result='failed';report.failure=error.message;save();console.error(error.message);process.exitCode=1;}
