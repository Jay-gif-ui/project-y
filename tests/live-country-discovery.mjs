// Opt-in real API audit, no fixtures. Run with --env-file=.env.local.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import loadTypescript from './load-typescript.mjs';

const cached = new Map();
const queries = [];
const realFetch = globalThis.fetch;
async function auditedFetch(url, options) {
  const address = String(url);
  if (!cached.has(address)) cached.set(address, (async () => {
    try {
      const response = await realFetch(url, options);
      const body = await response.json();
      const parsed = new URL(address);
      queries.push({path:parsed.pathname,params:Object.fromEntries([...parsed.searchParams].filter(([key])=>key!=='api_key')),status:response.status,count:body.results?.length});
      if (!response.ok) cached.delete(address);
      return {body,status:response.status};
    } catch (error) { cached.delete(address); throw error; }
  })());
  const result = await cached.get(address);
  return Response.json(result.body, {status:result.status});
}
const tmdb = loadTypescript({fetch:auditedFetch})('lib/tmdb.ts');
const now = new Date();
const recentStart = `${now.getUTCFullYear()-1}-07-01`;
const today = now.toISOString().slice(0,10);
const key = media => `${media.mediaType}:${media.id}`;

function inspect(result, region, surface) {
  assert.ok(result.data,`${region} ${surface} failed: ${result.error}`);
  assert.ok(!result.partial,`${region} ${surface} was partial`);
  const items=result.data.items;
  const localIds=new Set(result.data.localIds);
  const recent=items.filter(item=>item.releaseDate>=recentStart).length;
  const local=items.filter(item=>localIds.has(key(item))).length;
  assert.equal(new Set(items.map(key)).size,items.length,'Duplicate title');
  assert.ok(items.every(item=>item.releaseDate<=today),'Future release');
  assert.ok(!items.length||recent/items.length>=0.8,'Old catalog dominance');
  const firstOld=items.findIndex(item=>item.releaseDate<recentStart);
  if(firstOld!==-1)assert.ok(items.slice(firstOld).every(item=>item.releaseDate<recentStart),'Old item preceded a recent title');
  const summary={region,surface,count:items.length,local,recent,movies:items.filter(item=>item.mediaType==='movie').length,tv:items.filter(item=>item.mediaType==='tv').length};
  console.log(JSON.stringify(summary));
  return {...summary,items:items.map(item=>({id:item.id,type:item.mediaType,title:item.title,date:item.releaseDate,local:localIds.has(key(item)),origins:item.originCountries,rating:item.rating,votes:item.voteCount,popularity:item.popularity}))};
}

(async()=>{
  assert.ok(process.env.TMDB_API_KEY,'A server TMDB credential is required');
  const movie=tmdb.getCollection('movie','trending'),tv=tmdb.getCollection('tv','trending');
  const [movieTrend,tvTrend]=await Promise.all([movie,tv]);
  assert.ok(movieTrend.data?.length&&tvTrend.data?.length,'Global trending unavailable');
  const report={auditedAt:now.toISOString(),dns:process.env.DISCOVERY_AUDIT_DNS||'system',window:{recentStart,today},countries:[],genreChecks:[],queries};
  for(const region of ['IN','US','GB','JP','KR']){
    const homeResult=await tmdb.getCountryDiscovery(region,{surface:'home'}, {movie,tv},now);
    const home=inspect(homeResult,region,'home');
    const browseResult=await tmdb.getCountryDiscovery(region,{surface:'browse'}, {movie,tv},now);
    const browse=inspect(browseResult,region,'browse');
    assert.ok(home.count<=12&&browse.count<=36);
    assert.ok(home.local>home.count/2,`${region} homepage is not local-majority`);
    assert.ok(browse.local>browse.count/2,`${region} browse is not local-majority`);
    assert.ok(home.movies&&home.tv&&browse.movies&&browse.tv,'Both types required');
    const providerSamples=[];
    const sampleItems=[...homeResult.data.items.filter(item=>homeResult.data.localIds.includes(key(item))).slice(0,2),...homeResult.data.items.filter(item=>!homeResult.data.localIds.includes(key(item))).slice(0,1)];
    for(const item of sampleItems){
      const providers=await tmdb.getWatchProviders(item.mediaType,item.id,region);
      assert.ok(providers.data,'Providers unavailable');
      const names=['flatrate','free','ads','rent','buy'].flatMap(type=>providers.data[type].map(provider=>provider.name));
      assert.ok(names.length,'No real legal provider reported');
      providerSamples.push({id:item.id,type:item.mediaType,providers:[...new Set(names)]});
    }
    report.countries.push({region,home,browse,providerSamples});
  }
  for(const type of ['movie','tv']){
    const result=await tmdb.getCountryDiscovery('IN',{surface:'browse',filter:type},undefined,now);
    assert.ok(result.data?.items.length&&result.data.items.every(item=>item.mediaType===type),'Media filter failed');
    const genre=await tmdb.discoverGenre(type,'IN',18,'recent',now);
    assert.ok(genre.data?.length&&genre.data.every(item=>item.mediaType===type&&item.genreIds.includes(18)),'Genre regression');
    report.genreChecks.push({type,region:'IN',countryFilterCount:result.data.items.length,genreCount:genre.data.length,recent:genre.data.filter(item=>item.releaseDate>=`${now.getUTCFullYear()-1}-01-01`).length});
  }
  const output=process.env.DISCOVERY_AUDIT_OUTPUT||'docs/country-discovery-live-audit.json';
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(`Live country audit passed; ${queries.length} network requests. Report: ${output}`);
})().catch(error=>{console.error(`Live country audit failed: ${error.message}`);process.exitCode=1;});
