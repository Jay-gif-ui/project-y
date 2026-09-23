import { test } from 'node:test';
import assert from 'node:assert/strict';
import loadTypescript from './load-typescript.mjs';
const load = loadTypescript();
const { discoveryDates, discoveryParams, rankDiscovery, rankCountryDiscovery, combineDiscovery } = load('lib/discovery.ts');
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

test('homepage uses six Discover calls, shared global trends, and at most 6+6 unique picks',async()=>{
  const {tmdb,calls}=api(async url=>{
    const type=url.pathname.endsWith('/tv')?'tv':'movie';
    const offset=url.searchParams.has('with_origin_country')?100:0;
    return Response.json({results:Array.from({length:20},(_,i)=>raw(offset+i+1,type))});
  });
  const result=await tmdb.getPopularAvailableInRegion('US',{movie:Promise.resolve({data:[]}),tv:Promise.resolve({data:[]})},now);
  assert.equal(calls.length,6);
  assert.equal(result.data.length,12);
  assert.equal(result.data.filter(item=>item.mediaType==='tv').length,6);
  assert.equal(new Set(result.data.map(item=>`${item.mediaType}:${item.id}`)).size,12);
  for(const call of calls){assert.equal(call.params.watch_region,'US');assert.equal(call.options.next.revalidate,1800);assert.equal(call.options.cache,'force-cache');}
});

const qualityMedia=(id,date='2026-08-01',extra={})=>media(id,date,{rating:7,voteCount:100,popularity:40,...extra});

test('all enabled countries receive the same strong local-origin preference without local quotas',()=>{
  for(const country of ENABLED_COUNTRIES){
    const locals=Array.from({length:5},(_,i)=>qualityMedia(i+1,'2026-08-01',{originCountries:[country.code]}));
    const international=Array.from({length:5},(_,i)=>qualityMedia(i+101));
    const result=rankCountryDiscovery([...locals,...international].map(media=>({media})),[],country.code,now,{limit:6});
    assert.equal(result.filter(pick=>pick.local).length,5,country.code);
    assert.equal(result.at(-1).local,false);
    const params=discoveryParams('movie',country.code,now,{countryFocused:true,local:true});
    assert.equal(params['primary_release_date.gte'],'2025-07-01');
    assert.equal(params.with_origin_country,country.code);
  }
});

test('weak and unsupported local titles cannot be inserted to meet a percentage',()=>{
  const weak=qualityMedia(1,'2026-09-01',{rating:3,voteCount:1000,popularity:1000});
  const unknown=qualityMedia(2,'2026-01-01',{rating:0,voteCount:0});
  const strong=qualityMedia(3,'2026-09-01',{popularity:1000});
  const result=rankCountryDiscovery([{media:weak,local:true},{media:unknown,local:true},{media:strong}], [strong], 'IN', now);
  assert.deepEqual(Array.from(result,pick=>pick.media.id),[3]);
});

test('strong international current trends can beat weaker local releases without a fixed split',()=>{
  const local=qualityMedia(1,'2025-09-01',{popularity:2});
  const international=qualityMedia(2,'2026-09-20',{popularity:1000});
  const result=rankCountryDiscovery([{media:local,local:true},{media:international}],[international],'JP',now);
  assert.equal(result[0].media.id,2);
  assert.equal(result[1].local,true);
});

test('old catalog popularity alone is excluded; supported exceptions stay behind all recent picks',()=>{
  const recent=Array.from({length:6},(_,i)=>({media:qualityMedia(i+1,'2025-07-01',{popularity:1}),local:true}));
  const old=qualityMedia(50,'2016-01-01',{popularity:1e8,rating:9,voteCount:1000});
  assert.ok(!rankCountryDiscovery([...recent,{media:old,local:true}],[],'IN',now).some(pick=>pick.media.id===50));
  const result=rankCountryDiscovery([...recent,{media:old,local:true}],[old],'IN',now);
  assert.equal(result.length,6);
  assert.equal(result.at(-1).media.id,50);
  assert.equal(result.filter(pick=>pick.media.releaseDate<'2025-07-01').length,1);
  assert.equal(rankCountryDiscovery([{media:old,local:true}],[old],'IN',now).length,0);
});

test('country quality uses vote confidence; future and undated titles never qualify',()=>{
  const candidates=[qualityMedia(1, '2026-08-01',{voteCount:25}),qualityMedia(2, '2026-08-01',{voteCount:500}),qualityMedia(3,'2027-01-01'),qualityMedia(4,undefined,{releaseDate:undefined})].map(media=>({media,local:true}));
  const result=rankCountryDiscovery(candidates,[],'KR',now);
  assert.deepEqual(Array.from(result,pick=>pick.media.id),[2,1]);
});

test('browse strengthens locality, expands only local pools, and TV filtering skips movie requests',async()=>{
  const {tmdb,calls}=api(async url=>{
    const local=url.searchParams.has('with_origin_country');
    const page=Number(url.searchParams.get('page')||1);
    return Response.json({total_pages:2,results:Array.from({length:20},(_,i)=>raw((local?100:0)+page*20+i,'tv'))});
  });
  const result=await tmdb.getCountryDiscovery('KR',{surface:'browse',filter:'tv'},undefined,now);
  assert.equal(result.data.items.length,36);
  assert.equal(result.data.localIds.length,36);
  assert.ok(result.data.items.every(item=>item.mediaType==='tv'));
  assert.equal(calls.filter(call=>call.path.includes('/discover/')).length,4);
  assert.ok(calls.every(call=>!call.path.includes('/movie')));
  assert.equal(calls.find(call=>call.params.page==='2').params.with_origin_country,'KR');
  const one={media:qualityMedia(1),local:true};
  const home=rankCountryDiscovery([one],[],'KR',now)[0];
  const browse=rankCountryDiscovery([one],[],'KR',now,{surface:'browse'})[0];
  assert.ok(browse.score>home.score);
});

test('origin/production metadata is normalized and sparse countries do not request nonexistent page 2',async()=>{
  const {tmdb,calls}=api(async()=>Response.json({total_pages:1,results:[{...raw(1,'movie'),origin_country:['CA'],production_countries:[{iso_3166_1:'GB'}]}]}));
  const result=await tmdb.getCountryDiscovery('CA',{surface:'browse',filter:'movie'},undefined,now);
  assert.deepEqual(Array.from(result.data.items[0].originCountries),['CA','GB']);
  assert.equal(calls.filter(call=>call.path.includes('/discover/')).length,3);
  assert.ok(!calls.some(call=>call.params.page==='2'));
});

test('failed local services cannot fall back to a global-only country chart',async()=>{
  const {tmdb}=api(async url=>url.searchParams.has('with_origin_country')?Response.json({}, {status:401}):Response.json({results:[raw(1,'movie')]}));
  const result=await tmdb.getCountryDiscovery('US',{surface:'home',filter:'movie'},undefined,now);
  assert.equal(result.error,'unauthorized');
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
  const result=await tmdb.getPopularAvailableInRegion('IN',{movie:Promise.resolve({data:[media(99)]}),tv:Promise.resolve({data:[]})},now);
  assert.equal(result.error,'unauthorized');
  const empty=api(async()=>Response.json({results:[]}));
  const none=await empty.tmdb.getPopularAvailableInRegion('IN',{movie:Promise.resolve({data:[media(99)]}),tv:Promise.resolve({data:[]})},now);
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
