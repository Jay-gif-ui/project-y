import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import loadTypescript from './load-typescript.mjs';
const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const base = loadTypescript()('lib/title-interest.ts');
const media = (id, type = 'movie') => ({ id, mediaType: type, title: `Fixture ${id}`, overview:'', rating:7, voteCount:30, genreIds:[] });

test('view input rejects malformed identities and accepts both detail routes', () => {
  for (const input of [null, {}, {mediaType:'person',titleId:5}, {mediaType:'movie',titleId:'5'}, {mediaType:'tv',titleId:-1}, {mediaType:'movie',titleId:Infinity}]) assert.equal(base.parseTitleView(input), null);
  for (const type of ['movie','tv']) assert.equal(base.parseTitleView({mediaType:type,titleId:123}).mediaType, type);
});
test('ranking validation refuses foreign countries and corrupt rows', () => {
  const row = {country_code:'US',media_type:'movie',title_id:1,recent_views:5,score:4};
  const rows = base.validateInterestRows([row,{...row,country_code:'IN'},{...row,score:NaN},{...row,title_id:2,score:5},{...row,media_type:'person'}],'US');
  assert.deepEqual(Array.from(rows, r => r.title_id), [2,1]);
});
test('ten most-checked titles win; sparse countries fill from existing discovery without duplicates', () => {
  const fallback = Array.from({length:15},(_,i) => media(i+1));
  const result = base.composeInterestShelf('movie',[media(7),media(2),media(7),media(1,'tv')],fallback);
  assert.equal(result.source,'mixed'); assert.equal(result.communityCount,2); assert.equal(result.items.length,10);
  assert.deepEqual(Array.from(result.items.slice(0,3),x=>x.id),[7,2,1]);
  assert.equal(new Set(result.items.map(x=>x.id)).size,10);
  assert.equal(result.items[0].discoverySignal,'ifynex-activity');
  assert.equal(base.composeInterestShelf('movie',[],fallback).source,'tmdb');
  assert.equal(base.composeInterestShelf('movie',fallback,[]).source,'community');
  assert.equal(base.composeInterestShelf('tv',[],fallback).items.length,0);
});

function harness(options = {}) {
  const calls = [];
  const rpc = [];
  const env = options.env ?? {NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-only-secret',TMDB_API_KEY:'fixture-key'};
  const mockClient = {
    auth: {getUser:async()=>options.invalidAuth ? {error:{},data:{user:null}} : {data:{user:{id:'account-fixture',user_metadata:{country_code:'IN'}}}}},
    from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{country_code:options.profileCountry??'US'}})})})}),
    rpc:async(name,args)=>{rpc.push({name,args});return {data:options.rpcResult??'recorded',error:options.rpcError};},
  };
  const load = loadTypescript({process:{env},Buffer,AbortSignal,fetch:async(url,init)=>{
    calls.push({url:String(url),init});
    if(String(url).includes('/rpc/')) return Response.json(options.rows??[]);
    if(options.missingTitle) return Response.json({}, {status:404});
    return Response.json({id:550,title:'TMDB fixture',name:'TV fixture',vote_average:7,vote_count:20});
  }}, {'node:crypto':crypto,'@supabase/supabase-js':{createClient:()=>mockClient},'next/server':require('next/server')});
  return {server:load('lib/title-interest-server.ts'),route:load('app/api/title-view/route.ts'),calls,rpc};
}
function request(body = {mediaType:'movie',titleId:550}, headers = {}) {
  return new NextRequest('http://localhost:3100/api/title-view',{method:'POST',body:JSON.stringify(body),headers:{origin:'http://localhost:3100','content-type':'application/json',cookie:'ifynex_country=IN',...headers}});
}
test('anonymous cookies are signed, expire daily, and account hashes cannot identify users across days', () => {
  const {server} = harness(); const now = new Date('2026-09-30T12:00:00Z');
  const cookie = server.visitorCookie(now);
  assert.equal(server.validVisitorCookie(cookie,now),true);
  assert.equal(server.validVisitorCookie(cookie.slice(0,-1)+'x',now),false);
  assert.equal(server.validVisitorCookie(cookie,new Date('2026-10-01')),false);
  assert.match(server.viewerHash(cookie,undefined,now),/^[a-f0-9]{64}$/);
  assert.notEqual(server.viewerHash(cookie,'account',now),server.viewerHash(cookie,'account',new Date('2026-10-01')));
});
test('verified profile overrides selected cookie; invalid authorization never falls back to anonymous', async () => {
  const {server} = harness();
  assert.equal((await server.resolveViewCountry('IN','Bearer fixture')).country,'US');
  assert.equal((await server.resolveViewCountry('GB',null)).country,'GB');
  assert.equal(await server.resolveViewCountry('ZZ',null),null);
  assert.equal(await harness({invalidAuth:true}).server.resolveViewCountry('IN','Bearer fixture'),null);
});
test('country reads are cached for five minutes with the country in the cache URL', async () => {
  const h = harness({rows:[{country_code:'US',media_type:'movie',title_id:550,recent_views:10,score:8}]});
  assert.equal((await h.server.getCountryInterest('US')).length,1);
  assert.equal((await h.server.getCountryInterest('GB')).length,0);
  assert.ok(h.calls[0].url.endsWith('p_country=US')); assert.ok(h.calls[1].url.endsWith('p_country=GB'));
  assert.equal(h.calls[0].init.next.revalidate,300); assert.equal(h.calls[0].init.cache,'force-cache');
});
test('missing analytics configuration preserves TMDB fallback', async () => {
  const h = harness({env:{}}); const result = await h.server.getHomeInterest('IN',[media(1),media(2,'tv')]);
  assert.equal(result.movie.source,'tmdb'); assert.equal(result.movie.items[0].id,1);
  assert.equal(result.tv.items[0].id,2); assert.equal(h.calls.length,0);
  assert.equal((await h.route.POST(request())).status,503);
});
test('endpoint refuses cross-site, invalid, oversized and privacy-disabled events', async () => {
  const h = harness();
  assert.equal((await h.route.POST(request(undefined,{origin:'https://elsewhere.test'}))).status,403);
  assert.equal((await h.route.POST(request({mediaType:'person',titleId:550}))).status,400);
  assert.equal((await h.route.POST(request({padding:'x'.repeat(600)}))).status,413);
  assert.equal((await h.route.POST(request(undefined,{dnt:'1'}))).status,202);
  assert.equal((await h.route.POST(request(undefined,{'sec-gpc':'1'}))).status,202);
  assert.equal(h.rpc.length,0);
});
test('detail views bootstrap, validate real metadata, record correct country, and deduplicate', async () => {
  const h = harness(); const first = await h.route.POST(request());
  assert.equal(first.status,202); assert.equal((await first.json()).reason,'initialized');
  const cookie = first.cookies.get(base.VIEW_COOKIE).value;
  assert.ok(first.headers.get('set-cookie').includes('HttpOnly')); assert.equal(h.rpc.length,0);
  const result = await h.route.POST(request(undefined,{cookie:`ifynex_country=IN; ${base.VIEW_COOKIE}=${cookie}`,authorization:'Bearer fixture'}));
  assert.equal(result.status,200); assert.equal((await result.json()).recorded,true);
  assert.equal(h.rpc[0].args.p_country,'US'); assert.equal(h.rpc[0].args.p_title_id,550);
  assert.equal(JSON.stringify(h.rpc).includes('account-fixture'),false);
  const duplicate = harness({rpcResult:'duplicate'});
  assert.equal((await (await duplicate.route.POST(request(undefined,{cookie:`ifynex_country=GB; ${base.VIEW_COOKIE}=${cookie}`}))).json()).reason,'duplicate');
  assert.equal(duplicate.rpc[0].args.p_country,'GB');
});
test('nonexistent titles, database failures and rate limits cannot create successful events', async () => {
  for (const [option,status] of [[{missingTitle:true},404],[{rpcError:{}},503],[{rpcResult:'rate-limited'},429]]) {
    const h = harness(option), cookie = h.server.visitorCookie();
    assert.equal((await h.route.POST(request(undefined,{cookie:`ifynex_country=IN; ${base.VIEW_COOKIE}=${cookie}`}))).status,status);
    if(option.missingTitle) assert.equal(h.rpc.length,0);
  }
});
