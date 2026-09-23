// Opt-in audit against real TMDB responses. Never loads fixtures or prints credentials.
// Run: node --env-file=.env.local tests/live-discovery.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import loadTypescript from './load-typescript.mjs';
const requests = new Map();
const queries = [];
const actualFetch = globalThis.fetch;
async function cachedFetch(url, options) {
  const address = String(url);
  if (!requests.has(address)) requests.set(address, (async () => {
    const response = await actualFetch(url, options);
    const body = await response.json();
    const parsed = new URL(address);
    queries.push({ path:parsed.pathname, params:Object.fromEntries([...parsed.searchParams].filter(([key])=>key!=='api_key')), status:response.status, count:body.results?.length });
    if (!response.ok) console.log(JSON.stringify({ path:parsed.pathname, status:response.status, errors:body.errors, message:body.status_message, params:queries.at(-1).params }));
    return {status:response.status, body};
  })());
  const response = await requests.get(address);
  return Response.json(response.body, {status:response.status});
}
const load = loadTypescript({fetch:cachedFetch});
const tmdb = load('lib/tmdb.ts');
const {discoveryDates} = load('lib/discovery.ts');
const now = new Date();
const {recentStart,today} = discoveryDates(now);

async function baseline(region) {
  const pools=await Promise.all(['movie','tv'].flatMap(type=>[false,true].map(async local=>{
    const url=new URL(`https://api.themoviedb.org/3/discover/${type}`);
    Object.entries({api_key:process.env.TMDB_API_KEY.trim(),language:'en-US',include_adult:'false',watch_region:region,with_watch_monetization_types:'flatrate|free|ads|rent|buy',sort_by:'popularity.desc','vote_count.gte':'25',...(local?{with_origin_country:region}:{})}).forEach(([key,value])=>url.searchParams.set(key,value));
    const response=await cachedFetch(url,{signal:AbortSignal.timeout(12000)});
    assert.equal(response.status,200,'Baseline TMDB request failed');
    const body=await response.json();
    return body.results.map(item=>({id:item.id,mediaType:type,releaseDate:type==='movie'?item.release_date:item.first_air_date}));
  })));
  const alternate=(a,b)=>Array.from({length:Math.max(a.length,b.length)},(_,i)=>[a[i],b[i]]).flat().filter(Boolean);
  const general=alternate(pools[0],pools[2]),local=alternate(pools[1],pools[3]);
  const items=[],seen=new Set();
  while(items.length<18&&(general.length||local.length))for(const item of [general.shift(),general.shift(),local.shift()])if(item&&items.length<18&&!seen.has(`${item.mediaType}:${item.id}`)){seen.add(`${item.mediaType}:${item.id}`);items.push(item);}
  return {count:items.length,recent:items.filter(item=>item.releaseDate>=recentStart&&item.releaseDate<=today).length};
}

(async()=>{
  if(!process.env.TMDB_API_KEY?.trim())throw new Error('TMDB_API_KEY is required for the live audit');
  const movie=tmdb.getCollection('movie','trending'),tv=tmdb.getCollection('tv','trending');
  const trends=await Promise.all([movie,tv]);
  assert.ok(trends.every(result=>result.data?.length),'Live global trending unavailable');
  const report={auditedAt:now.toISOString(),dns:process.env.DISCOVERY_AUDIT_DNS||'system',window:{recentStart,today},countries:[],genres:[],queries};
  for(const region of ['IN','US','GB','JP','KR']){
    const [result,before]=await Promise.all([tmdb.getPopularAvailableInRegion(region,{movie,tv},now),baseline(region)]);
    assert.ok(result.data,'Country query failed');
    assert.ok(!result.partial,'Country query had a partial upstream failure');
    const items=result.data;
    const recent=items.filter(item=>item.releaseDate>=recentStart).length;
    assert.ok(items.every(item=>item.releaseDate<=today),'Future title leaked into current discovery');
    assert.ok(!items.length||recent/items.length>=0.75,'Older titles exceeded 25%');
    if(items.length)assert.ok(items.some(item=>item.mediaType==='movie')&&items.some(item=>item.mediaType==='tv'),'Expected both media types in the live region');
    const checked=[];
    for(const item of items.slice(0,4)){
      const providers=await tmdb.getWatchProviders(item.mediaType,item.id,region);
      assert.ok(providers.data,'Provider request failed');
      const names=['flatrate','free','ads','rent','buy'].flatMap(key=>providers.data[key].map(provider=>provider.name));
      assert.ok(names.length,'Discover title did not have reported providers');
      checked.push({id:item.id,type:item.mediaType,providers:[...new Set(names)]});
    }
    const summary={region,before,after:{count:items.length,recent,movies:items.filter(item=>item.mediaType==='movie').length,tv:items.filter(item=>item.mediaType==='tv').length},items:items.map(item=>({id:item.id,type:item.mediaType,title:item.title,date:item.releaseDate})),providerSamples:checked};
    report.countries.push(summary);
    console.log(JSON.stringify({region,before,after:summary.after}));
  }
  for(const type of ['movie','tv']){
    const genres=await tmdb.getGenres(type);
    assert.ok(genres.data?.length,'Official genres unavailable');
    const genre=genres.data.find(item=>item.name==='Drama')??genres.data[0];
    for(const region of ['IN','US']){
      const result=await tmdb.discoverGenre(type,region,genre.id,'recent',now);
      assert.ok(result.data&&!result.partial,'Genre discovery failed');
      assert.ok(result.data.every(item=>item.genreIds.includes(genre.id)&&item.mediaType===type),'Genre/media mismatch');
      const recent=result.data.filter(item=>item.releaseDate>=recentStart).length;
      assert.ok(!result.data.length||recent/result.data.length>=0.75,'Genre old catalog dominance');
      const summary={region,type,genre:genre.name,count:result.data.length,recent};
      report.genres.push(summary);console.log(JSON.stringify(summary));
    }
  }
  const destination=path.resolve(process.env.DISCOVERY_AUDIT_OUTPUT||'docs/discovery-live-audit.json');
  fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
  console.log(`Live audit passed. ${requests.size} distinct TMDB requests; report: ${destination}`);
})().catch(error=>{console.error(`Live audit failed: ${error.message}`);process.exitCode=1;});
