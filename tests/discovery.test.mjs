import { test } from 'node:test';
import assert from 'node:assert/strict';
import loadTypescript from './load-typescript.mjs';
const load = loadTypescript();
const { discoveryDates, discoveryParams, rankDiscovery, combineDiscovery } = load('lib/discovery.ts');
const { ENABLED_COUNTRIES } = load('lib/countries.ts');
const now = new Date('2026-09-23T12:00:00Z');
// Synthetic fixtures are only used for deterministic tests, never rendered by the app.
const media = (id, releaseDate = '2026-08-01', extra = {}) => ({ id, mediaType: 'movie', title: `Fixture ${id}`, releaseDate, popularity: 25, voteCount: 0, rating: 0, genreIds: [28], overview: '', ...extra });

test('date windows roll forward in UTC, without hardcoding 2025 or 2026', () => {
  assert.equal(discoveryDates(now).recentStart, '2025-01-01');
  assert.equal(discoveryDates(new Date('2027-01-01T00:00:00Z')).recentStart, '2026-01-01');
  assert.equal(discoveryDates(now).activityStart, '2026-06-25');
});

test('every supported country and both media types enforce legal availability and bounded dates', () => {
  for (const country of ENABLED_COUNTRIES) for (const type of ['movie', 'tv']) {
    const params = discoveryParams(type, country.tmdbRegion, now);
    assert.equal(params.watch_region, country.tmdbRegion);
    assert.equal(params.with_watch_monetization_types, 'flatrate|free|ads|rent|buy');
    assert.equal(params.sort_by, 'popularity.desc');
    assert.equal(params[type === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'], '2025-01-01');
    assert.equal(params[type === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'], '2026-09-23');
    assert.equal(params.with_origin_country, undefined);
    assert.equal(discoveryParams(type, country.code, now, { local:true }).with_origin_country, country.code);
  }
  const activity = discoveryParams('tv', 'JP', now, {activity:true, genreId:16});
  assert.equal(activity['air_date.gte'], '2026-06-25');
  assert.equal(activity['air_date.lte'], '2026-09-23');
  assert.equal(activity['first_air_date.gte'], undefined);
  assert.equal(activity.with_genres, '16');
});

test('huge old popularity cannot admit a catalog title without current evidence', () => {
  const recent = Array.from({length:12}, (_, i) => media(i + 1));
  const old = media(50, '2016-01-01', {popularity:1e12});
  const result = rankDiscovery([...recent, old].map(media => ({media})), [], now);
  assert.equal(result.length, 12);
  assert.ok(!result.some(item => item.id === 50));
});

test('current trends and recently airing older TV survive, capped at one per three recent titles', () => {
  const recent = Array.from({length:12}, (_, i) => media(i + 1, '2025-01-01', {mediaType:'tv'}));
  const old = Array.from({length:12}, (_, i) => media(i + 50, '2017-01-01', {mediaType:'tv',popularity:1e9}));
  const result = rankDiscovery([...recent.map(media => ({media})), ...old.map(media => ({media, recentlyAired:true}))], old, now);
  assert.equal(result.filter(item => item.releaseDate < '2025-01-01').length, 4);
  assert.equal(result.length, 16);
  assert.equal(rankDiscovery(old.map(media => ({media, recentlyAired:true})), old, now).length, 0);
});

test('freshness and current-year boosts beat otherwise equal previous-year titles; no vote-count gate', () => {
  const result = rankDiscovery([media(1, '2025-09-01'), media(2, '2026-09-01'), media(3, '2026-01-01')].map(media => ({media})), [], now);
  assert.deepEqual(Array.from(result, item => item.id), [2,3,1]);
});

test('future/undated items are excluded and same IDs across media types stay distinct', () => {
  const result = rankDiscovery([media(1),media(1),media(1,'2026-08-01',{mediaType:'tv'}),media(2,'2026-12-01'),media(3,undefined,{releaseDate:undefined})].map(media => ({media})), [], now);
  assert.equal(result.length, 2);
  assert.notEqual(result[0].mediaType, result[1].mediaType);
});

test('mixed media preserves both types and missing pools return shorter lists', () => {
  const candidates = Array.from({length:12}, (_,i) => ({media:media(i+1),local:i>=9}));
  const result = rankDiscovery(candidates, [], now, {limit:9});
  const combined = combineDiscovery(result, result.map(item => ({...item,mediaType:'tv'})));
  assert.equal(combined.length,18);
  assert.equal(combined.filter(item=>item.mediaType==='tv').length,9);
  assert.equal(combineDiscovery([],result).length,9);
});

test('year-only genre discovery excludes older trending and returning TV', () => {
  const old = media(1,'2025-12-01',{mediaType:'tv'});
  assert.equal(rankDiscovery([{media:old,recentlyAired:true},{media:media(2)}],[old],now,{period:'year'}).length,1);
  assert.equal(discoveryParams('tv','KR',now,{period:'year'})['first_air_date.gte'],'2026-01-01');
});

function api(mock) {
  const calls=[];
  const tmdb=loadTypescript({process:{env:{TMDB_API_KEY:'test-only'}},fetch:async (url,options)=>{
    calls.push({path:url.pathname,params:Object.fromEntries([...url.searchParams].filter(([key])=>key!=='api_key')),options});
    return mock(url,options);
  }})('lib/tmdb.ts');
  return {tmdb,calls};
}
const raw=(id,type,date='2026-08-01')=>({id,title:`Movie fixture ${id}`,name:`TV fixture ${id}`,release_date:date,first_air_date:date,popularity:30,vote_count:60,vote_average:7,genre_ids:[type==='tv'?10759:28]});

test('homepage reuses shared trends and returns a substantial bounded mixed selection',async()=>{
  const {tmdb,calls}=api(async url=>{
    if(url.pathname.includes('/trending/'))return Response.json({results:[]});
    const type=url.pathname.endsWith('/tv')?'tv':'movie';
    const offset=url.searchParams.has('with_origin_country')?100:0;
    return Response.json({results:Array.from({length:20},(_,i)=>({...raw(offset+i+1,type),...(type==='tv'?{origin_country:[offset?'US':'IN']}: {})}))});
  });
  const result=await tmdb.getPopularAvailableInRegion('US',{movie:Promise.resolve({data:[]}),tv:Promise.resolve({data:[]})},now);
  assert.equal(calls.length,10);
  assert.equal(result.data.length,24);
  assert.ok(result.data.some(item=>item.mediaType==='tv') && result.data.some(item=>item.mediaType==='movie'));
  assert.equal(new Set(result.data.map(item=>`${item.mediaType}:${item.id}`)).size,24);
  for(const call of calls){if(call.path.includes('/discover/'))assert.equal(call.params.watch_region,'US');assert.equal(call.options.next.revalidate,1800);assert.equal(call.options.cache,'force-cache');}
});

test('global trending preserves upstream order, includes genuine older trends, and ignores region',async()=>{
  const {tmdb,calls}=api(async()=>Response.json({results:[raw(4,'movie','2016-01-01'),raw(2,'movie')]}));
  const result=await tmdb.getCollection('movie','trending','IN');
  assert.deepEqual(Array.from(result.data,item=>item.id),[4,2]);
  assert.equal(calls[0].path,'/3/trending/movie/week');
  assert.equal(calls[0].params.region,undefined);
});

test('partial failures are explicit; empty availability is not replaced by unverified global titles',async()=>{
  const {tmdb}=api(async url=>url.pathname.endsWith('/tv')?Response.json({}, {status:401}):Response.json({results:[]}));
  const result=await tmdb.getPopularAvailableInRegion('US',{movie:Promise.resolve({data:[media(99)]}),tv:Promise.resolve({data:[]})},now);
  assert.equal(result.error,'unauthorized');
  const empty=api(async()=>Response.json({results:[]}));
  const none=await empty.tmdb.getPopularAvailableInRegion('US',{movie:Promise.resolve({data:[media(99)]}),tv:Promise.resolve({data:[]})},now);
  assert.equal(none.data.length,0);
  assert.equal(none.error,undefined);
});

test('official TV genre validation rejects movie-only IDs and genre queries keep region, dates and genre',async()=>{
  const {tmdb,calls}=api(async url=>url.pathname.includes('/genre/')?Response.json({genres:[{id:10759,name:'Action & Adventure'}]}):Response.json({results:[raw(1,'tv')]}));
  assert.equal((await tmdb.discoverGenre('tv','JP',28,'recent',now)).error,'not-found');
  const result=await tmdb.discoverGenre('tv','JP',10759,'recent',now);
  assert.equal(result.data.length,1);
  for(const call of calls.filter(call=>call.path.includes('/discover/'))){assert.equal(call.params.with_genres,'10759');assert.equal(call.params.watch_region,'JP');}
  assert.equal(calls[0].options.next.revalidate,86400);
});
