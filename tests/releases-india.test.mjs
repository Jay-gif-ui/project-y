import { test } from 'node:test';
import assert from 'node:assert/strict';
import loadTypescript from './load-typescript.mjs';
const load=loadTypescript();
const {releaseDates,releaseParams,selectReleaseItems}=load('lib/releases.ts');
const {releaseCandidate,relevantReleasedTitle}=load('lib/release-metadata.ts');
const {mergeIndiaTrending}=load('lib/india-trending.ts');
const {INDIA_TRENDING}=load('data/india-trending.ts');
const now=new Date('2026-09-25T12:00:00Z');
const media=(id,date='2026-09-25',extra={})=>({id,mediaType:'movie',title:`Fixture ${id}`,releaseDate:date,overview:'',rating:0,voteCount:0,popularity:0,genreIds:[],originCountries:['IN'],...extra});
const candidate=(item,date,kind='theatrical')=>({media:item,events:[{date,kind,regional:true}]});
const ids=items=>Array.from(items,item=>`${item.mediaType}:${item.id}`);
const offer={flatrate:[{provider_id:8,provider_name:'Fixture provider'}]};
const raw=(id,type='movie',region='IN')=>({id,...(type==='movie'?{title:`Fixture ${id}`}:{name:`Fixture ${id}`}),release_date:'2026-09-25',first_air_date:'2026-09-25',origin_country:[region],vote_count:0,vote_average:0,popularity:0,'watch/providers':{results:{[region]:offer}}});

test('provider listings never stand in for a verified regional movie date',()=>{
  const item=media(1,'2026-09-24');
  for(const data of [{},{'watch/providers':{results:{IN:offer}}},{release_dates:{results:[{iso_3166_1:'US',release_dates:[{type:3,release_date:'2026-09-24'}]}]}}]) {
    assert.equal(selectReleaseItems([releaseCandidate(item,data,'IN')],now).length,0);
  }
});

test('verified theatre and digital releases survive missing OTT offers without inventing availability',()=>{
  for(const type of [3,4]) {
    const data={release_dates:{results:[{iso_3166_1:'IN',release_dates:[{type,release_date:'2026-09-24T00:00:00Z'}]}]},'watch/providers':{results:{}}};
    const [item]=selectReleaseItems([releaseCandidate(media(1),data,'IN')],now);
    assert.equal(item.releaseEvent.status,'released');
    assert.equal(item.releaseAvailability,'not-found');
    delete data['watch/providers'];
    assert.equal(selectReleaseItems([releaseCandidate(media(1),data,'IN')],now)[0].releaseAvailability,'unknown');
  }
});

test('regional schedules win even outside the window and contradictory TV episodes are rejected',()=>{
  const input={media:media(1),events:[{date:'2026-10-20',kind:'theatrical',regional:true},{date:'2026-09-24',kind:'premiere',regional:false}]};
  assert.equal(selectReleaseItems([input],now).length,0);
  const tv=media(2,'2026-10-20',{mediaType:'tv'});
  assert.equal(selectReleaseItems([releaseCandidate(tv,{last_episode_to_air:{air_date:'2026-09-24'}},'IN')],now).length,0);
});

test('rolling release boundaries, UTC rollover, invalid dates, newest then upcoming soon',()=>{
  assert.equal(releaseDates(now).recentStart,'2026-09-11');
  assert.equal(releaseDates(now).upcomingEnd,'2026-10-02');
  assert.equal(releaseDates(new Date('2027-01-01T00:00Z')).recentStart,'2026-12-18');
  const fixtures=['2026-09-10','2026-09-11','2026-09-25','2026-09-26','2026-10-02','2026-10-03','2026-02-30'].map((date,i)=>candidate(media(i+1),date));
  assert.deepEqual(ids(selectReleaseItems(fixtures,now)),['movie:3','movie:2','movie:4','movie:5']);
  assert.deepEqual(ids(selectReleaseItems(fixtures,now,'released')),['movie:3','movie:2']);
  assert.deepEqual(ids(selectReleaseItems(fixtures,now,'upcoming')),['movie:4','movie:5']);
});
test('regional digital date admits an older movie; old popularity without a fresh event does not',()=>{
  const item=media(1,'2020-01-01',{popularity:1e9});
  const data={release_dates:{results:[{iso_3166_1:'IN',release_dates:[{type:4,release_date:'2026-09-24T00:00:00Z'}]},{iso_3166_1:'US',release_dates:[{type:3,release_date:'2020-01-01T00:00:00Z'}]}]}};
  assert.equal(selectReleaseItems([releaseCandidate(item,data,'IN')],now)[0].releaseEvent.kind,'digital');
  assert.equal(selectReleaseItems([releaseCandidate(item,data,'US')],now).length,0);
});
test('explicit future India schedule never becomes released due to global date or provider offers',()=>{
  const item=media(1,'2026-09-20');
  const data={'watch/providers':{results:{IN:offer}},release_dates:{results:[{iso_3166_1:'IN',release_dates:[{type:3,release_date:'2026-10-02T00:00:00Z'}]}]}};
  const items=selectReleaseItems([releaseCandidate(item,data,'IN')],now);
  assert.equal(items[0].releaseEvent.status,'upcoming');
  assert.equal(selectReleaseItems([releaseCandidate(item,data,'IN')],now,'released').length,0);
  assert.equal(relevantReleasedTitle(item,data,'IN','2026-09-25',true),false);
});
test('TV returning season/episode dates qualify independently of old series premiere',()=>{
  const item=media(1,'2010-01-01',{mediaType:'tv',originCountries:['US']});
  const data={'watch/providers':{results:{IN:offer}},last_episode_to_air:{air_date:'2026-09-24'},next_episode_to_air:{air_date:'2026-09-30'}};
  const input=[releaseCandidate(item,data,'IN')];
  assert.equal(selectReleaseItems(input,now)[0].releaseEvent.date,'2026-09-24');
  assert.equal(selectReleaseItems(input,now,'upcoming')[0].releaseEvent.date,'2026-09-30');
  assert.equal(releaseCandidate(item,data,'JP').events.length,0);
});
test('every country uses real regional release/availability queries without rating floors',()=>{
  for(const region of ['IN','US','GB','JP','KR']) {
    assert.equal(releaseParams('movie',region,now,'recent').region,region);
    assert.equal(releaseParams('movie',region,now,'upcoming')['release_date.gte'],'2026-09-26');
    assert.equal(releaseParams('tv',region,now,'available-episodes').watch_region,region);
    assert.equal(releaseParams('tv',region,now,'local-premieres').with_origin_country,region);
    assert.equal(releaseParams('movie',region,now,'recent')['vote_count.gte'],undefined);
  }
});
test('manual rank beats age/popularity, global order survives merge, namespaces and duplicate IDs are handled',()=>{
  const old=media(1,'1994-09-22'), fresh=media(2), tv=media(1,'2026-09-01',{mediaType:'tv'}), future=media(9,'2026-10-02');
  const items=mergeIndiaTrending([old,future,fresh],[fresh,tv,old],now);
  assert.deepEqual(ids(items),['movie:1','movie:2','tv:1']);
  assert.equal(items[0].discoverySignal,'india-curated');
  assert.deepEqual(ids(mergeIndiaTrending([old,fresh],[tv],now,'newest')),['movie:2','tv:1','movie:1']);
  assert.equal(relevantReleasedTitle(future,{'watch/providers':{results:{IN:offer}}},'IN','2026-09-25',true),false);
});
test('release deduplication retains one title and does not turn upcoming into released',()=>{
  const a=candidate(media(1),'2026-10-02'), b=candidate(media(1),'2026-09-26');
  const items=selectReleaseItems([a,b,b],now);
  assert.equal(items.length,1);assert.equal(items[0].releaseEvent.date,'2026-09-26');
  assert.equal(items[0].discoverySignal,'upcoming-release');
});

function api(mock){const calls=[];const load=loadTypescript({process:{env:{TMDB_API_KEY:'test-only'}},fetch:async(url,options)=>{calls.push({path:url.pathname,params:Object.fromEntries([...url.searchParams].filter(([name])=>name!=='api_key')),options});return mock(url);}});return {tmdb:load('lib/tmdb.ts'),releases:load('lib/tmdb-releases.ts'),calls};}
test('India server uses configured IDs without searches; home/See All, filtering, pagination and global order',async()=>{
  const {tmdb,calls}=api(async url=>{
    const type=url.pathname.includes('/tv')?'tv':'movie';
    if(url.pathname.includes('/trending/'))return Response.json({results:Array.from({length:12},(_,i)=>raw(8000+i,type,'US'))});
    const id=Number(url.pathname.split('/').at(-1));return Response.json(raw(id,type,'IN'));
  });
  const home=await tmdb.getCountryDiscovery('IN',{},undefined,now);
  const first=await tmdb.getCountryDiscovery('IN',{surface:'browse'},undefined,now);
  assert.deepEqual(ids(home.data.items),ids(first.data.items));
  assert.deepEqual(ids(home.data.items.slice(0,10)),Array.from(INDIA_TRENDING.titles,x=>`${x.type}:${x.id}`));
  const second=await tmdb.getCountryDiscovery('IN',{surface:'browse',page:2},undefined,now);
  assert.equal(new Set([...ids(first.data.items),...ids(second.data.items)]).size,first.data.total);
  const movie=await tmdb.getCountryDiscovery('IN',{surface:'browse',filter:'movie'},undefined,now);
  const tv=await tmdb.getCountryDiscovery('IN',{surface:'browse',filter:'tv'},undefined,now);
  assert.ok(movie.data.items.every(x=>x.mediaType==='movie'));assert.ok(tv.data.items.every(x=>x.mediaType==='tv'));
  const global=await tmdb.getCollection('movie','trending');
  assert.deepEqual(Array.from(global.data,x=>x.id),Array.from({length:12},(_,i)=>8000+i));
  assert.ok(calls.every(x=>!x.path.includes('/search/')&&!x.path.includes('/discover/')));
  assert.ok(calls.every(x=>x.options.next.revalidate===1800));
});
test('country releases verify detail events, apply filters, respect origin and do not fetch trending',async()=>{
  const {releases,calls}=api(async url=>{
    const type=url.pathname.includes('/tv')?'tv':'movie';
    if(url.pathname.includes('/discover/'))return Response.json({results:[raw(1,type),raw(2,type)]});
    const id=Number(url.pathname.split('/').at(-1));const item=raw(id,type);item.release_date=id===1?'2026-09-24':'2026-10-02';item.first_air_date=item.release_date;
    item.release_dates={results:[{iso_3166_1:'IN',release_dates:[{type:3,release_date:item.release_date+'T00:00:00Z'}]}]};return Response.json(item);
  });
  const all=await releases.getCountryReleases('IN',{},now);
  assert.equal(all.data.total,4);assert.equal(all.partial,false);
  const upcoming=await releases.getCountryReleases('IN',{status:'upcoming',filter:'movie'},now);
  assert.deepEqual(ids(upcoming.data.items),['movie:2']);
  assert.equal(upcoming.data.items[0].releaseEvent.status,'upcoming');
  assert.ok(calls.every(x=>!x.path.includes('/trending/')));
});
test('release outage is explicit; future-only India curation never leaks into trending',async()=>{
  const failed=api(async()=>Response.json({},{status:401}));
  assert.equal((await failed.releases.getCountryReleases('IN',{},now)).error,'unauthorized');
  const future=api(async url=>url.pathname.includes('/trending/')?Response.json({results:[]}):Response.json({...raw(Number(url.pathname.split('/').at(-1))),release_date:'2026-10-02',first_air_date:'2026-10-02'}));
  const result=await future.tmdb.getCountryDiscovery('IN',{},undefined,now);
  assert.equal(result.data.total,0);assert.equal(result.partial,false);
});
test('weekly-only trends survive a full daily feed and concurrent metadata requests are shared',async()=>{
  const {tmdb,calls}=api(async url=>{
    if(url.pathname.includes('/trending/'))return Response.json({results:Array.from({length:20},(_,i)=>raw((url.pathname.endsWith('/week')?9000:8000)+i))});
    return Response.json(raw(Number(url.pathname.split('/').at(-1))));
  });
  await Promise.all([tmdb.getDiscoveryMetadata('movie',500),tmdb.getDiscoveryMetadata('movie',500)]);
  assert.equal(calls.filter(x=>x.path==='/3/movie/500').length,1);
  const result=await tmdb.getCountryDiscovery('IN',{filter:'movie'},undefined,now);
  assert.ok(result.data.items.some(x=>x.discoverySignal==='weekly-trend'));
  assert.ok(result.data.items.some(x=>x.discoverySignal==='daily-trend'));
});
