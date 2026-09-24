import { test } from 'node:test';
import assert from 'node:assert/strict';
import loadTypescript from './load-typescript.mjs';
const load = loadTypescript();
const { rankCountryDiscovery, selectCountryPicks, countryTrendingDates, countryTrendingParams, countryPopularity } = load('lib/country-trending.ts');
const { ENABLED_COUNTRIES } = load('lib/countries.ts');
const now = new Date('2026-09-24T12:00:00Z');
const media = (id, date = '2026-09-01', extra = {}) => ({ id, mediaType:'movie', title:`Test fixture ${id}`, releaseDate:date, popularity:40, voteCount:100, rating:7, genreIds:[28], overview:'', ...extra });
const candidate = (item, extra = {}) => ({media:item, available:true, local:true, ...extra});
const ids = picks => Array.from(picks, pick => `${pick.media.mediaType}:${pick.media.id}`);

test('all country queries use availability, exact local origin, dynamic dates, and bounded movie activity', () => {
  for (const country of ENABLED_COUNTRIES) for (const type of ['movie','tv']) {
    for (const pool of ['local','international','activity']) {
      const p = countryTrendingParams(type,country.code,now,pool);
      assert.equal(p.watch_region,country.code);
      assert.equal(p.with_watch_monetization_types,'flatrate|free|ads|rent|buy');
      assert.equal(p.with_origin_country,pool==='international'?undefined:country.code);
      assert.equal(p[type==='movie'?'primary_release_date.lte':'first_air_date.lte'],'2026-09-24');
      if (type==='movie') assert.ok(p['primary_release_date.gte']);
      if (type==='tv'&&pool==='activity') {
        assert.equal(p['air_date.gte'],'2026-08-27');
        assert.equal(p['air_date.lte'],'2026-09-24');
      }
    }
  }
  assert.equal(countryTrendingDates(new Date('2027-01-01')).recentStart,'2026-07-01');
  assert.equal(countryTrendingParams('movie','IN',now,'activity')['primary_release_date.gte'],'2026-07-26');
});

test('old catalog popularity, ratings, votes and origin cannot qualify a title', () => {
  const stale = ['2016-01-01','2017-01-01','2018-01-01','2025-11-01','2026-01-01'].map((date,i)=>candidate(media(i+1,date,{popularity:1e12,voteCount:1e8,rating:9})));
  assert.equal(rankCountryDiscovery(stale,[],'IN',now).length,0);
});

test('2026 freshness dominates and late-2025 carryovers need genuine current evidence', () => {
  const fresh = media(1), carryover = media(2,'2025-11-01'), old = media(3,'2016-01-01',{popularity:1e12});
  const result = rankCountryDiscovery([fresh,carryover,old].map(item=>candidate(item)),[carryover,old],'IN',now);
  assert.deepEqual(ids(result),['movie:1','movie:2','movie:3']);
  assert.equal(result[1].signals.reason,'weekly-trend');
  assert.equal(rankCountryDiscovery([candidate(carryover)],[],'IN',now).length,0);
});

test('recent-airing evidence requires credible interest and is restricted to TV', () => {
  const oldTV = media(1,'2016-01-01',{mediaType:'tv'});
  assert.equal(rankCountryDiscovery([candidate(oldTV,{recentlyAired:true})],[],'JP',now).length,1);
  assert.equal(rankCountryDiscovery([candidate({...oldTV,popularity:1},{recentlyAired:true})],[],'JP',now).length,0);
  assert.equal(rankCountryDiscovery([candidate({...oldTV,mediaType:'movie'},{recentlyAired:true})],[],'JP',now).length,0);
});

test('same strong local preference applies to every country, without weak-title quotas', () => {
  for (const country of ENABLED_COUNTRIES) {
    const local=media(1,undefined,{originCountries:[country.code]}), other=media(2,undefined,{popularity:100});
    const result=rankCountryDiscovery([candidate(local,{local:false}),candidate(other,{local:false})],[],country.code,now);
    assert.equal(result[0].local,true);
    assert.ok(result[0].score>result[1].score);
    assert.equal(rankCountryDiscovery([candidate(media(3,undefined,{rating:3,popularity:1000}))],[],country.code,now).length,0);
  }
});

test('strong current international titles can outrank local releases', () => {
  const local=media(1,'2026-06-01'), international=media(2,'2026-09-20',{popularity:100});
  const picks=rankCountryDiscovery([candidate(local),candidate(international,{local:false})],[international],'KR',now);
  assert.equal(picks[0].media.id,2);
  assert.equal(picks[0].local,false);
});

test('legal availability is mandatory, including actual global trends', () => {
  const item=media(1);
  assert.equal(rankCountryDiscovery([candidate(item,{available:false})],[item],'GB',now).length,0);
});

test('soft diversity admits competitive international weekly trends without forcing weak filler', () => {
  const locals=Array.from({length:30},(_,i)=>media(i+1));
  const international=media(100,undefined,{popularity:100});
  const picks=rankCountryDiscovery([...locals.map(item=>candidate(item)),candidate(international,{local:false})],[international],'US',now);
  assert.ok(selectCountryPicks(picks).slice(0,24).some(pick=>!pick.local));
  const weak={...picks.find(pick=>!pick.local),score:1};
  assert.ok(selectCountryPicks([...picks.filter(pick=>pick.local),weak]).slice(0,24).every(pick=>pick.local));
});

test('bounded absolute popularity is stable under catalog outliers and the score is explainable', () => {
  const item=media(1,'2026-09-24');
  const first=rankCountryDiscovery([candidate(item)],[],'IN',now)[0];
  const more=rankCountryDiscovery([candidate(item),candidate(media(2,'2016-01-01',{popularity:1e100}))],[],'IN',now)[0];
  const expected=40+20+12*countryPopularity(item)+8*0.7*100/150+32;
  assert.ok(Math.abs(first.score-expected)<1e-10);
  assert.equal(more.score,first.score);
});

test('no old slot is reserved; resurfacing exceptions are capped at 10% and follow recent releases', () => {
  const recent=Array.from({length:27},(_,i)=>media(i+1));
  const old=Array.from({length:20},(_,i)=>media(i+101,'2016-01-01',{popularity:10000}));
  const picks=rankCountryDiscovery([...recent,...old].map(item=>candidate(item)),old,'IN',now);
  const all=selectCountryPicks(picks);
  assert.equal(all.length,30);
  assert.equal(all.filter(pick=>pick.older).length,3);
  assert.ok(all.slice(27).every(pick=>pick.older));
  assert.equal(selectCountryPicks(picks,24).filter(pick=>pick.older).length,0);
  assert.equal(selectCountryPicks(picks.filter(pick=>pick.older)).length,0);
});

test('media identity, future/missing/invalid dates and newest sort are handled consistently', () => {
  const valid=[media(1),media(1,'2026-09-20',{mediaType:'tv'})];
  const invalid=[media(2,'2027-01-01'),media(3,'2026-02-30'),media(4,undefined,{releaseDate:undefined})];
  const picks=rankCountryDiscovery([...valid,...valid,...invalid].map(item=>candidate(item)),[],'US',now);
  assert.equal(picks.length,2);
  assert.equal(selectCountryPicks(picks,120,'newest')[0].media.mediaType,'tv');
});

test('future activity adapter defaults to zero and rejects stale or cross-country signals', () => {
  const item=media(1,'2025-11-01');
  for (const signal of [undefined,{region:'US',asOf:'2026-09-24',recentScore:1},{region:'IN',asOf:'2026-08-01',recentScore:1},{region:'IN',asOf:'2026-09-25',recentScore:1}]) {
    assert.equal(rankCountryDiscovery([candidate(item)],[],'IN',now,{activity:new Map(signal?[['movie:1',signal]]:[])}).length,0);
  }
  const result=rankCountryDiscovery([candidate(item)],[],'IN',now,{activity:new Map([['movie:1',{region:'IN',asOf:'2026-09-23',recentScore:0.8}]])});
  assert.equal(result[0].signals.activity,0.8);
});

function api(mock) {
  const calls=[];
  const tmdb=loadTypescript({process:{env:{TMDB_API_KEY:'test-only'}},fetch:async(url,options)=>{
    calls.push({path:url.pathname,params:Object.fromEntries([...url.searchParams].filter(([key])=>key!=='api_key')),options});
    return mock(url);
  }})('lib/tmdb.ts');
  return {tmdb,calls};
}
const raw=(id,type,date='2026-09-01',extra={})=>({id,title:`Movie test ${id}`,name:`TV test ${id}`,release_date:date,first_air_date:date,popularity:40,vote_count:100,vote_average:7,genre_ids:[],...extra});
const emptyTrends={movie:Promise.resolve({data:[]}),tv:Promise.resolve({data:[]})};

test('home and See All page one match; pagination only slices eligible results without more catalog requests',async()=>{
  const {tmdb,calls}=api(async url=>{
    const type=url.pathname.endsWith('/tv')?'tv':'movie';
    const local=url.searchParams.has('with_origin_country'), page=Number(url.searchParams.get('page'));
    return Response.json({total_pages:2,results:Array.from({length:20},(_,i)=>raw((local?100:500)+page*20+i,type))});
  });
  const home=await tmdb.getCountryDiscovery('IN',{surface:'home'},emptyTrends,now);
  const browse=await tmdb.getCountryDiscovery('IN',{surface:'browse'},emptyTrends,now);
  const second=await tmdb.getCountryDiscovery('IN',{surface:'browse',page:2},emptyTrends,now);
  const keys=r=>Array.from(r.data.items,item=>`${item.mediaType}:${item.id}`);
  assert.deepEqual(keys(home),keys(browse));
  assert.equal(home.data.items.length,24);
  assert.equal(home.data.total,80);
  assert.ok(home.data.items.some(item=>item.mediaType==='movie')&&home.data.items.some(item=>item.mediaType==='tv'));
  assert.ok(keys(second).every(key=>!keys(home).includes(key)));
  assert.equal(calls.length,24); // Eight bounded queries per uncached invocation; Next caches identical URLs.
  assert.ok(calls.every(call=>Number(call.params.page)<=2&&call.options.next.revalidate===1800));
});

test('media/year/sort filters keep current eligibility; invalid page values clamp',async()=>{
  const {tmdb,calls}=api(async()=>Response.json({results:[raw(1,'tv'),raw(2,'tv','2016-01-01',{popularity:1e12}),raw(3,'tv','2026-09-20')]}));
  const result=await tmdb.getCountryDiscovery('JP',{surface:'browse',filter:'tv',period:'year',sort:'newest',page:999},emptyTrends,now);
  assert.deepEqual(Array.from(result.data.items,item=>item.id),[3,1]);
  assert.equal(result.data.page,1);
  assert.ok(calls.every(call=>!call.path.includes('/movie')));
  assert.equal((await tmdb.getCountryDiscovery('JP',{page:NaN},emptyTrends,now)).data.page,1);
});

test('weekly trend additions have bounded real provider checks and empty availability cannot become a fallback',async()=>{
  const {tmdb,calls}=api(async url=>url.pathname.endsWith('/watch/providers')?Response.json({results:{IN:{flatrate:url.pathname.includes('/1/')?[{provider_id:9,provider_name:'Test provider'}]:[]}}}):Response.json({results:[]}));
  const trends={movie:Promise.resolve({data:Array.from({length:20},(_,i)=>media(i+1))}),tv:Promise.resolve({data:[]})};
  const result=await tmdb.getCountryDiscovery('IN',{filter:'movie'},trends,now);
  assert.deepEqual(Array.from(result.data.items,item=>item.id),[1]);
  assert.equal(calls.filter(call=>call.path.endsWith('/watch/providers')).length,4);
});

test('all five selected country values change local queries/results; missing services are explicit',async()=>{
  const {tmdb}=api(async url=>{
    const region=url.searchParams.get('watch_region');
    const id=['IN','US','GB','JP','KR'].indexOf(region)+1;
    return Response.json({results:[raw(id,'movie',undefined,{origin_country:[region]})]});
  });
  const ids=[];
  for (const region of ['IN','US','GB','JP','KR']) ids.push((await tmdb.getCountryDiscovery(region,{filter:'movie'},emptyTrends,now)).data.items[0].id);
  assert.equal(new Set(ids).size,5);
  const failed=api(async url=>url.searchParams.has('with_origin_country')?Response.json({},{status:401}):Response.json({results:[raw(99,'movie')]}));
  assert.equal((await failed.tmdb.getCountryDiscovery('IN',{filter:'movie'},emptyTrends,now)).error,'unauthorized');
  const partial=api(async url=>url.searchParams.has('with_origin_country')?Response.json({results:[raw(1,'movie')]}):Response.json({},{status:401}));
  assert.equal((await partial.tmdb.getCountryDiscovery('IN',{filter:'movie'},emptyTrends,now)).partial,true);
});
