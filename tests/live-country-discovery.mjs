// Real API audit. Credentials stay in the server process and are stripped from reports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import loadTypescript from './load-typescript.mjs';
const cached=new Map(),queries=[];
const realFetch=globalThis.fetch;
async function auditedFetch(url,options){
  const address=String(url);
  if(!cached.has(address))cached.set(address,(async()=>{
    try{
      const response=await realFetch(url,options),body=await response.json(),parsed=new URL(address);
      queries.push({path:parsed.pathname,params:Object.fromEntries([...parsed.searchParams].filter(([key])=>key!=='api_key')),status:response.status,count:body.results?.length});
      if(!response.ok)cached.delete(address);
      return{body,status:response.status};
    }catch(error){cached.delete(address);throw error;}
  })());
  const result=await cached.get(address);
  return Response.json(result.body,{status:result.status});
}
const load=loadTypescript({fetch:auditedFetch}),tmdb=load('lib/tmdb.ts');
const {countryTrendingDates}=load('lib/country-trending.ts');
const now=new Date(),dates=countryTrendingDates(now),key=media=>`${media.mediaType}:${media.id}`;
const report={auditedAt:now.toISOString(),window:dates,countries:[],queries};
function check(result,region){
  assert.ok(result.data,`${region} failed: ${result.error}`);
  assert.ok(!result.partial,`${region} returned partial data`);
  assert.ok(result.data.items.every(item=>item.releaseDate<=dates.today),'Future release');
  return result.data;
}
function summary(items,localIds){
  return{count:items.length,local:items.filter(item=>localIds.has(key(item))).length,currentYear:items.filter(item=>item.releaseDate.startsWith(String(dates.year))).length,latePreviousYear:items.filter(item=>item.releaseDate>=dates.recentStart&&item.releaseDate<`${dates.year}-01-01`).length,older:items.filter(item=>item.releaseDate<dates.recentStart).length,movies:items.filter(item=>item.mediaType==='movie').length,tv:items.filter(item=>item.mediaType==='tv').length};
}
(async()=>{
  assert.ok(process.env.TMDB_API_KEY,'A server TMDB credential is required');
  const movie=tmdb.getCollection('movie','trending'),tv=tmdb.getCollection('tv','trending');
  const [movieTrend,tvTrend]=await Promise.all([movie,tv]);
  assert.ok(movieTrend.data?.length&&tvTrend.data?.length,'Global trending unavailable');
  const trendIds=new Set([...movieTrend.data,...tvTrend.data].map(key)),fingerprints=new Set();
  for(const region of ['IN','US','GB','JP','KR']){
    const home=check(await tmdb.getCountryDiscovery(region,{surface:'home'},{movie,tv},now),region);
    const first=check(await tmdb.getCountryDiscovery(region,{surface:'browse'},{movie,tv},now),region);
    assert.deepEqual(home.items.map(key),first.items.map(key),'Home and See All diverged');
    const items=[...first.items],localIds=new Set(first.localIds),requestsBeforePages=queries.length;
    for(let page=2;page<=first.totalPages;page++){
      const next=check(await tmdb.getCountryDiscovery(region,{surface:'browse',page},{movie,tv},now),region);
      items.push(...next.items);next.localIds.forEach(id=>localIds.add(id));
    }
    assert.equal(queries.length,requestsBeforePages,'Pagination fetched new catalog pages');
    assert.equal(new Set(items.map(key)).size,items.length,'Duplicate across pages');
    assert.equal(items.length,first.total,'Incorrect total');
    const homeSummary=summary(home.items,new Set(home.localIds)),allSummary=summary(items,localIds);
    console.log(JSON.stringify({region,home:homeSummary,browse:allSummary,pages:first.totalPages}));
    const country={region,home:homeSummary,browse:allSummary,pages:first.totalPages,providerSamples:[],items:[]};
    report.countries.push(country);
    const airingIds=new Set();
    for(const [url,promise]of cached){
      const parsed=new URL(url);
      if(parsed.pathname==='/3/discover/tv'&&parsed.searchParams.get('watch_region')===region&&parsed.searchParams.get('air_date.gte')===dates.activityStart){
        const response=await promise;response.body.results?.forEach(item=>airingIds.add(`tv:${item.id}`));
      }
    }
    country.items=items.map(item=>({id:item.id,type:item.mediaType,title:item.title,date:item.releaseDate,local:localIds.has(key(item)),weeklyTrend:trendIds.has(key(item)),recentlyAired:airingIds.has(key(item)),popularity:item.popularity,votes:item.voteCount,rating:item.rating}));
    assert.ok(homeSummary.currentYear>homeSummary.count/2,'Homepage current-year majority missing');
    assert.ok(homeSummary.local>homeSummary.count/2,`${region} homepage local majority missing`);
    assert.ok(allSummary.local>allSummary.count/2,`${region} browse local majority missing`);
    assert.ok(homeSummary.movies&&homeSummary.tv&&allSummary.movies&&allSummary.tv,'Both types required');
    assert.ok(allSummary.older<=Math.floor(allSummary.count/10),'Old catalog dominance');
    const firstOld=items.findIndex(item=>item.releaseDate<dates.recentStart);
    if(firstOld>=0)assert.ok(items.slice(firstOld).every(item=>item.releaseDate<dates.recentStart),'Older title preceded recent');
    for(const item of items){
      const age=(Date.parse(dates.today)-Date.parse(item.releaseDate))/86400000;
      if(age>180)assert.ok(trendIds.has(key(item))||airingIds.has(key(item)),`No current evidence: ${key(item)}`);
    }
    fingerprints.add(home.items.map(key).join(','));
    const samples=[home.items.find(item=>item.mediaType==='movie'),home.items.find(item=>item.mediaType==='tv'),home.items.find(item=>!home.localIds.includes(key(item)))].filter(Boolean);
    for(const item of samples){
      const providers=await tmdb.getWatchProviders(item.mediaType,item.id,region);assert.ok(providers.data,'Provider lookup failed');
      const names=['flatrate','free','ads','rent','buy'].flatMap(kind=>providers.data[kind].map(provider=>provider.name));
      assert.ok(names.length,`No reported provider for ${key(item)} in ${region}`);
      country.providerSamples.push({id:item.id,type:item.mediaType,providers:[...new Set(names)]});
    }
    for(const type of ['movie','tv']){
      const filtered=check(await tmdb.getCountryDiscovery(region,{surface:'browse',filter:type,sort:'newest',period:'year'},{movie,tv},now),region);
      assert.ok(filtered.items.length&&filtered.items.every(item=>item.mediaType===type&&item.releaseDate.startsWith(String(dates.year))),'Media/year filter failed');
      assert.deepEqual(filtered.items.map(item=>item.releaseDate),filtered.items.map(item=>item.releaseDate).sort().reverse(),'Newest sort failed');
    }
  }
  assert.equal(fingerprints.size,5,'Country change did not change results');
  assert.ok(report.countries.some(country=>country.home.local<country.home.count),'No international title survived');
  fs.writeFileSync(process.env.DISCOVERY_AUDIT_OUTPUT||'docs/country-discovery-live-audit.json',JSON.stringify(report,null,2)+'\n');
  console.log(`Live current-trending audit passed; ${queries.length} unique requests across all five countries, filters and provider samples.`);
})().catch(error=>{
  fs.writeFileSync(process.env.DISCOVERY_AUDIT_OUTPUT||'docs/country-discovery-live-audit.json',JSON.stringify({...report,failure:error.message},null,2)+'\n');
  console.error(`Live current-trending audit failed: ${error.message}`);process.exitCode=1;
});
