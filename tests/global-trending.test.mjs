import { test } from 'node:test';
import assert from 'node:assert/strict';
import loadTypescript from './load-typescript.mjs';

function service(responder) {
  const calls = [];
  const api = loadTypescript({ process: { env: { TMDB_API_KEY: 'test-only' } }, fetch: async url => {
    calls.push({ path: url.pathname, params: Object.fromEntries(url.searchParams) });
    return responder(url);
  } })('lib/tmdb.ts');
  return { api, calls };
}
const movie = (id, extra = {}) => ({ id, media_type: 'movie', title: `Movie ${id}`, popularity: 1000 - id, ...extra });
const tv = id => ({ id, media_type: 'tv', name: `TV ${id}` });

test('global All preserves combined TMDB order and excludes people, adult, malformed and duplicate entries', async () => {
  const { api, calls } = service(() => Response.json({ total_pages: 5, results: [tv(80), movie(90), {id:1,media_type:'person',name:'Person'}, movie(2,{adult:true}), movie(90), movie(4,{title:''}), tv(90), null] }));
  const result = await api.getGlobalTrending();
  assert.deepEqual(Array.from(result.data.items, item => `${item.mediaType}:${item.id}`), ['tv:80','movie:90','tv:90']);
  assert.equal(result.data.totalPages, 5);
  assert.equal(calls[0].path, '/3/trending/all/week');
  assert.equal(calls[0].params.region, undefined);
  assert.equal(calls[0].params.sort_by, undefined);
});

test('Movies and TV filters page through their actual weekly trending endpoints', async () => {
  const { api, calls } = service(url => Response.json({ total_pages: 3, results: [url.pathname.includes('/tv/') ? tv(Number(url.searchParams.get('page'))) : movie(Number(url.searchParams.get('page')))] }));
  for (const type of ['all','movie','tv']) for (const page of [1,2,3]) {
    const result = await api.getGlobalTrending(type, page);
    assert.equal(result.data.page, page);
    assert.equal(result.data.items[0].id, page);
    assert.equal(calls.at(-1).path, `/3/trending/${type}/week`);
    assert.equal(calls.at(-1).params.page, String(page));
  }
  assert.ok(calls.every(call => !call.path.includes('/popular') && !call.path.includes('/discover/')));
});

test('invalid pages are normalized, oversized pages clamp to upstream end, errors remain explicit', async () => {
  const { api, calls } = service(() => Response.json({ total_pages: 3, results: [] }));
  assert.equal((await api.getGlobalTrending('movie', -2)).data.page, 1);
  assert.equal((await api.getGlobalTrending('movie', 999)).data.page, 3);
  assert.equal(calls.at(-2).params.page, '500');
  assert.equal(calls.at(-1).params.page, '3');
  const failed = service(() => Response.json({}, {status:401}));
  assert.equal((await failed.api.getGlobalTrending()).error, 'unauthorized');
  const malformed = service(() => Response.json({}));
  assert.equal((await malformed.api.getGlobalTrending()).error, 'upstream');
});
