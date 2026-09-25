import { test } from 'node:test';
import assert from 'node:assert/strict';
import loadTypescript from './load-typescript.mjs';
const load = loadTypescript();
const { rankCountryDiscovery, selectCountryPicks, selectCountryMix, countryPageSlice, countryTrendingDates, countryTrendingParams, countryPopularity, COUNTRY_POOL_PAGES } = load('lib/country-trending.ts');
const { ENABLED_COUNTRIES } = load('lib/countries.ts');
const now = new Date('2026-09-24T12:00:00Z');
const media = (id, date = '2026-09-01', extra = {}) => ({ id, mediaType:'movie', title:`Test fixture ${id}`, releaseDate:date, popularity:40, voteCount:100, rating:7, genreIds:[28], overview:'', ...extra });
const candidate = (item, extra = {}) => ({media:item, available:true, local:true, ...extra});
const ids = picks => Array.from(picks, pick => `${pick.media.mediaType}:${pick.media.id}`);

test('all country queries use availability, exact local origin, dynamic dates, and bounded movie activity', () => {
  for (const country of ENABLED_COUNTRIES) for (const type of ['movie','tv']) {
    for (const pool of ['local','international','activity','international-activity']) {
      const p = countryTrendingParams(type,country.code,now,pool);
      assert.equal(p.watch_region,country.code);
      assert.equal(p.with_watch_monetization_types,'flatrate|free|ads|rent|buy');
      assert.equal(p.with_origin_country,pool.startsWith('international')?undefined:country.code);
      assert.equal(p[type==='movie'?'primary_release_date.lte':'first_air_date.lte'],'2026-09-24');
      if (type==='movie') assert.ok(p['primary_release_date.gte']);
      if (type==='tv'&&pool==='activity') {
        assert.equal(p['air_date.gte'],'2026-08-27');
        assert.equal(p['air_date.lte'],'2026-09-24');
      }
    }
  }
  assert.equal(countryTrendingDates(new Date('2027-01-01')).recentStart,'2026-07-01');
  assert.equal(countryTrendingParams('movie','CA',now,'activity')['primary_release_date.gte'],'2026-07-26');
});

test('old catalog popularity, ratings, votes and origin cannot qualify a title', () => {
  const stale = ['2016-01-01','2017-01-01','2018-01-01','2025-11-01','2026-01-01'].map((date,i)=>candidate(media(i+1,date,{popularity:1e12,voteCount:1e8,rating:9})));
  assert.equal(rankCountryDiscovery(stale,[],'CA',now).length,0);
});

test('late-2025 actual trends can outrank merely fresh releases; older catalog stays behind', () => {
  const fresh = media(1), carryover = media(2,'2025-11-01'), old = media(3,'2016-01-01',{popularity:1e12});
  const result = rankCountryDiscovery([fresh,carryover,old].map(item=>candidate(item)),[carryover,old],'CA',now);
  assert.deepEqual(ids(result),['movie:2','movie:1','movie:3']);
  assert.equal(result[0].signals.reason,'weekly-trend');
  assert.equal(rankCountryDiscovery([candidate(carryover)],[],'CA',now).length,0);
});

test('recent-airing evidence requires credible interest and is restricted to TV', () => {
  const oldTV = media(1,'2016-01-01',{mediaType:'tv'});
  assert.equal(rankCountryDiscovery([candidate(oldTV,{recentlyAired:true})],[],'JP',now).length,1);
  assert.equal(rankCountryDiscovery([candidate({...oldTV,popularity:1},{recentlyAired:true})],[],'JP',now).length,0);
  assert.equal(rankCountryDiscovery([candidate({...oldTV,mediaType:'movie'},{recentlyAired:true})],[],'JP',now).length,0);
});

test('small local preference applies to every country, without weak-title quotas', () => {
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
  const first=rankCountryDiscovery([candidate(item)],[],'CA',now)[0];
  const more=rankCountryDiscovery([candidate(item),candidate(media(2,'2016-01-01',{popularity:1e100}))],[],'CA',now)[0];
  const expected=18+6+12*countryPopularity(item)+4*0.7*100/150+8;
  assert.ok(Math.abs(first.score-expected)<1e-10);
  assert.equal(more.score,first.score);
});

test('no old slot is reserved; resurfacing exceptions are capped at 10% and follow recent releases', () => {
  const recent=Array.from({length:27},(_,i)=>media(i+1));
  const old=Array.from({length:20},(_,i)=>media(i+101,'2016-01-01',{popularity:10000}));
  const picks=rankCountryDiscovery([...recent,...old].map(item=>candidate(item)),old,'CA',now);
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
  for (const signal of [undefined,{region:'US',asOf:'2026-09-24',recentScore:1},{region:'CA',asOf:'2026-08-01',recentScore:1},{region:'CA',asOf:'2026-09-25',recentScore:1}]) {
    assert.equal(rankCountryDiscovery([candidate(item)],[],'CA',now,{activity:new Map(signal?[['movie:1',signal]]:[])}).length,0);
  }
  const result=rankCountryDiscovery([candidate(item)],[],'CA',now,{activity:new Map([['movie:1',{region:'CA',asOf:'2026-09-23',recentScore:0.8}]])});
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
    if(url.pathname.includes('/trending/'))return Response.json({results:[]});
    const type=url.pathname.endsWith('/tv')?'tv':'movie';
    const local=url.searchParams.has('with_origin_country'), page=Number(url.searchParams.get('page'));
    return Response.json({total_pages:2,results:Array.from({length:20},(_,i)=>raw((local?100:500)+page*20+i,type,undefined,type==='tv'?{origin_country:[local?'CA':'US']} : {}))});
  });
  const home=await tmdb.getCountryDiscovery('CA',{surface:'home'},emptyTrends,now);
  const browse=await tmdb.getCountryDiscovery('CA',{surface:'browse'},emptyTrends,now);
  const second=await tmdb.getCountryDiscovery('CA',{surface:'browse',page:2},emptyTrends,now);
  const keys=r=>Array.from(r.data.items,item=>`${item.mediaType}:${item.id}`);
  assert.deepEqual(keys(home),keys(browse));
  assert.equal(home.data.items.length,24);
  assert.equal(home.data.total,100);
  assert.equal(home.data.localIds.length,16);
  assert.equal(home.data.localTotal,80);
  assert.equal(home.data.internationalTotal,20);
  assert.ok(home.data.items.some(item=>item.mediaType==='movie')&&home.data.items.some(item=>item.mediaType==='tv'));
  assert.ok(keys(second).every(key=>!keys(home).includes(key)));
  assert.equal(calls.length,48); // Four bounded pools/type + daily; weekly shared.
  assert.ok(calls.some(call=>call.params.page==='2'));
  assert.ok(calls.every(call=>call.options.next.revalidate===1800));
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
  const {tmdb,calls}=api(async url=>url.searchParams.get('append_to_response')==='watch/providers'?Response.json({origin_country:['CA'],'watch/providers':{results:{CA:{flatrate:url.pathname.endsWith('/1')?[{provider_id:9,provider_name:'Test provider'}]:[]}}}}):Response.json({results:[]}));
  const trends={movie:Promise.resolve({data:Array.from({length:20},(_,i)=>media(i+1))}),tv:Promise.resolve({data:[]})};
  const result=await tmdb.getCountryDiscovery('CA',{filter:'movie'},trends,now);
  assert.deepEqual(Array.from(result.data.items,item=>item.id),[1]);
  assert.equal(calls.filter(call=>call.params.append_to_response==='watch/providers').length,4);
});

test('all five selected country values change local queries/results; missing services are explicit',async()=>{
  const {tmdb}=api(async url=>{
    const region=url.searchParams.get('watch_region');
    const id=['CA','US','GB','JP','KR'].indexOf(region)+1;
    return Response.json({results:[raw(id,'movie',undefined,{origin_country:[region]})]});
  });
  const ids=[];
  for (const region of ['CA','US','GB','JP','KR']) ids.push((await tmdb.getCountryDiscovery(region,{filter:'movie'},emptyTrends,now)).data.items[0].id);
  assert.equal(new Set(ids).size,5);
  const failed=api(async url=>url.searchParams.has('with_origin_country')?Response.json({},{status:401}):Response.json({results:[raw(99,'movie')]}));
  assert.equal((await failed.tmdb.getCountryDiscovery('CA',{filter:'movie'},emptyTrends,now)).error,'unauthorized');
  const partial=api(async url=>url.searchParams.has('with_origin_country')?Response.json({results:[raw(1,'movie')]}):Response.json({},{status:401}));
  assert.equal((await partial.tmdb.getCountryDiscovery('CA',{filter:'movie'},emptyTrends,now)).partial,true);
});

test('weak local freshness never masquerades as trending; latest is independently eligible', () => {
  const weak=media(1,'2026-09-23',{popularity:15,voteCount:7});
  const stub=media(2,'2026-09-24',{popularity:5,voteCount:0,rating:0});
  const current=media(3,'2026-09-01',{originCountries:['US']});
  const candidates=[candidate(weak),candidate(stub),candidate(current,{local:false})];
  const ranked=rankCountryDiscovery(candidates,[],'CA',now,{daily:[current]});
  assert.deepEqual(ids(ranked),['movie:3']);
  assert.equal(ranked[0].media.discoverySignal,'daily-trend');
});

test('daily and weekly confirmation lead origin and freshness; score uses real feed positions', () => {
  const local=media(1,'2026-09-24'), global=media(2,'2026-09-01');
  const candidates=[candidate(local),candidate(global,{local:false})];
  const both=rankCountryDiscovery(candidates,[global],'CA',now,{daily:[global]});
  assert.equal(both[0].media.id,2);
  assert.ok(both[0].score>both[1].score+30);
  const daily=rankCountryDiscovery(candidates,[],'CA',now,{daily:[global]});
  assert.equal(both[0].score-daily[0].score,10);
  const same=[candidate(global),candidate({...global,id:3},{local:false})];
  const equal=rankCountryDiscovery(same,[],'CA',now);
  assert.equal(equal[0].score-equal[1].score,8);
});

test('recent episodes keep an established returning series current, not a new premiere', () => {
  const returning=media(1,'2016-01-01',{mediaType:'tv'});
  const candidates=[candidate(returning,{recentlyAired:true})];
  const picks=rankCountryDiscovery(candidates,[],'JP',now);
  assert.equal(picks[0].older,true);
  assert.equal(picks[0].media.discoverySignal,'recent-airing');
  assert.equal(rankCountryDiscovery([candidate({...returning,voteCount:10},{recentlyAired:true})],[],'JP',now).length,0);
});

test('equally evidenced 2026 titles outrank late-2025 titles and new sort never admits old catalog', () => {
  const current=media(1), late=media(2,'2025-12-01'), catalog=media(3,'2017-01-01',{popularity:999999});
  const ranked=rankCountryDiscovery([current,late,catalog].map(item=>candidate(item)),[current,late],'CA',now);
  assert.deepEqual(ids(ranked),['movie:1','movie:2']);
  assert.deepEqual(ids(selectCountryPicks(ranked,120,'newest')),['movie:1','movie:2']);
});


test('all countries get exact 16/8 home and 200/50 browse when eligible supply exists', () => {
  for(const region of ['CA','US','GB','JP','KR']) {
    const candidates=Array.from({length:360},(_,i)=>candidate(media(i+1,`2026-09-${String(1+i%24).padStart(2,'0')}`,{mediaType:i%2?'movie':'tv'}),{local:i<260}));
    const picks=rankCountryDiscovery(candidates,[],region,now);
    const selection=selectCountryMix(picks);
    assert.equal(selection.home.length,24);
    assert.equal(selection.home.filter(pick=>pick.local).length,16);
    assert.equal(selection.all.length,250);
    assert.equal(selection.localTotal,200);
    assert.equal(selection.internationalTotal,50);
    assert.deepEqual(ids(selection.home),ids(countryPageSlice(selection).items));
    const pages=Array.from({length:11},(_,i)=>countryPageSlice(selection,i+1).items).flat();
    assert.equal(new Set(ids(pages)).size,250);
    assert.deepEqual(ids(pages),ids(selection.all));
    assert.ok(selection.home.some(pick=>pick.media.mediaType==='tv')&&selection.home.some(pick=>pick.media.mediaType==='movie'));
    const newest=selectCountryMix(picks,{sort:'newest'});
    assert.deepEqual(ids(newest.all).sort(),ids(selection.all).sort());
    assert.deepEqual(Array.from(newest.all,pick=>pick.media.releaseDate),Array.from(newest.all,pick=>pick.media.releaseDate).sort().reverse());
  }
});

test('short local supply never backfills with international titles, and sparse pagination loses nothing', () => {
  const picks=rankCountryDiscovery(Array.from({length:65},(_,i)=>candidate(media(i+1),{local:i<5})),[],'CA',now);
  const selection=selectCountryMix(picks);
  assert.equal(selection.home.length,13);
  assert.equal(selection.home.filter(pick=>pick.local).length,5);
  assert.equal(selection.all.length,13);
  const pages=Array.from({length:countryPageSlice(selection).totalPages},(_,i)=>countryPageSlice(selection,i+1).items).flat();
  assert.deepEqual(ids(pages),ids(selection.all));
  assert.equal(new Set(ids(pages)).size,13);
});

test('short See All lists stay local-led with an international allowance proportional to available local supply', () => {
  const picks=rankCountryDiscovery(Array.from({length:140},(_,i)=>candidate(media(i+1),{local:i<40})),[],'CA',now);
  const selection=selectCountryMix(picks);
  assert.equal(selection.localTotal,40);
  assert.equal(selection.internationalTotal,10);
  assert.equal(selection.home.filter(pick=>pick.local).length,16);
  const pages=Array.from({length:countryPageSlice(selection).totalPages},(_,i)=>countryPageSlice(selection,i+1).items).flat();
  assert.equal(new Set(ids(pages)).size,50);
  assert.deepEqual(ids(pages),ids(selection.all));
});


test('Discover pagination can supply 250 and never exceeds the bounded page budgets', async()=>{
  const {tmdb,calls}=api(async url=>{
    if(url.pathname.includes('/trending/'))return Response.json({results:[]});
    if(url.searchParams.has('append_to_response'))return Response.json({origin_country:['US'],'watch/providers':{results:{}}});
    const local=url.searchParams.has('with_origin_country'),page=Number(url.searchParams.get('page'));
    const type=url.pathname.endsWith('/tv')?'tv':'movie';
    return Response.json({total_pages:500,results:Array.from({length:20},(_,i)=>raw((local?100:5000)+page*20+i,type,undefined,{origin_country:[local?'CA':'US']}))});
  });
  const result=await tmdb.getCountryDiscovery('CA',{surface:'browse'},emptyTrends,now);
  assert.equal(result.data.total,250);
  assert.equal(result.data.localTotal,200);
  assert.equal(result.data.internationalTotal,50);
  assert.equal(result.data.localIds.length,16);
  assert.equal(calls.length,2*(Object.values(COUNTRY_POOL_PAGES).reduce((a,b)=>a+b,0)+1));
});

test('missing movie origin is not international when local query is truncated or fails mid-pagination', async()=>{
  for(const fails of [false,true]) {
    const {tmdb}=api(async url=>{
      if(url.pathname.includes('/trending/'))return Response.json({results:[]});
      if(url.searchParams.has('append_to_response'))return Response.json({origin_country:['CA'],'watch/providers':{results:{CA:{rent:[{provider_id:1,provider_name:'Test'}]}}}});
      const local=url.searchParams.has('with_origin_country'),page=Number(url.searchParams.get('page'));
      if(local&&page>1&&fails)return Response.json({},{status:401});
      return Response.json({total_pages:local?500:1,results:[raw(local?page:999,'movie')]});
    });
    const result=await tmdb.getCountryDiscovery('CA',{filter:'movie'},emptyTrends,now);
    assert.equal(result.data.internationalTotal,0);
    assert.ok(result.data.localIds.includes('movie:999'),'Real detail origin was not used');
    assert.equal(result.partial,fails);
  }
});

test('returning series with current episodes never crowd current releases off the homepage', () => {
  const fresh=Array.from({length:35},(_,i)=>candidate(media(i+1)));
  const returning=Array.from({length:30},(_,i)=>candidate(media(i+101,'2016-01-01',{mediaType:'tv',popularity:500}),{recentlyAired:true}));
  const feed=returning.map(item=>item.media);
  const picked=selectCountryPicks(rankCountryDiscovery([...fresh,...returning],feed,'CA',now,{daily:feed}));
  for(let count=1;count<=picked.length;count++) assert.ok(picked.slice(0,count).filter(pick=>pick.signals.airing).length<=Math.floor(count/5));
  assert.ok(picked.slice(0,24).filter(pick=>pick.media.releaseDate.startsWith('2026')).length>=20);
  assert.ok(picked.slice(0,24).some(pick=>pick.signals.airing));
});

test('local-origin filter narrows the qualified selection without relaxing eligibility', async()=>{
  const {tmdb}=api(async url=>{
    if(url.pathname.includes('/trending/'))return Response.json({results:[]});
    const local=url.searchParams.has('with_origin_country');
    return Response.json({results:[raw(local?1:2,'movie'),raw(local?3:4,'movie',undefined,{popularity:1,vote_count:0})]});
  });
  for(const view of ['trending']) {
    const result=await tmdb.getCountryDiscovery('CA',{filter:'movie',view,origin:'local'},emptyTrends,now);
    assert.deepEqual(Array.from(result.data.items,item=>item.id),[1]);
    assert.deepEqual(Array.from(result.data.localIds),['movie:1']);
  }
});
