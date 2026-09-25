import { test } from 'node:test';
import assert from 'node:assert/strict';
import loadTypescript from './load-typescript.mjs';

const load = loadTypescript();
const { normalizeWatchProviders, getProviderOffers } = load('lib/watch-providers.ts');
// Fixtures stay in tests; production only reads TMDB responses.
const provider = (id, name = `Test provider ${id}`) => ({ provider_id: id, provider_name: name, logo_path: '/test.png' });
const link = region => `https://www.themoviedb.org/movie/1/watch?locale=${region}`;
const payload = { results: {
  IN: { link: link('IN'), flatrate: [provider(8)], rent: [provider(2)], buy: [provider(2)] },
  US: { link: link('US'), flatrate: [provider(9)], ads: [provider(3)] },
  GB: { link: link('GB'), free: [provider(4)] },
  JP: { link: link('JP'), buy: [provider(5)] },
  KR: { link: link('KR'), rent: [provider(6)] },
} };
const plain = value => JSON.parse(JSON.stringify(value));

test('country selection keeps actual regional offers and the exact returned watch destination', () => {
  for (const region of ['IN', 'US', 'GB', 'JP', 'KR']) {
    const data = normalizeWatchProviders(payload, region.toLowerCase());
    assert.equal(data.link, link(region));
    for (const type of ['flatrate', 'rent', 'buy', 'free', 'ads']) {
      assert.deepEqual(Array.from(data[type], item => item.id), (payload.results[region][type] ?? []).map(item => item.provider_id));
    }
  }
  const absent = normalizeWatchProviders(payload, 'CA');
  assert.equal(absent.link, undefined);
  assert.equal(getProviderOffers(absent).length, 0, 'Never fall back to another country');
});

test('one provider row retains subscription, free, ad-supported, rental and purchase distinctions', () => {
  const data = normalizeWatchProviders({ results: { IN: {
    flatrate: [provider(1), provider(1), provider(2)], free: [provider(1)], ads: [provider(1)], rent: [provider(1)], buy: [provider(1)],
  } } }, 'IN');
  assert.equal(data.flatrate.length, 2);
  const offers = getProviderOffers(data);
  assert.deepEqual(Array.from(offers, item => item.id), [1, 2]);
  assert.deepEqual(plain(offers[0].types), ['flatrate', 'free', 'ads', 'rent', 'buy']);
  assert.deepEqual(plain(offers[1].types), ['flatrate']);
});

test('empty availability is distinct from a malformed or unavailable upstream response', () => {
  assert.equal(getProviderOffers(normalizeWatchProviders({ results: {} }, 'IN')).length, 0);
  for (const raw of [{}, { results: null }, { results: [] }, { results: { IN: 'invalid' } }]) {
    assert.equal(normalizeWatchProviders(raw, 'IN'), undefined);
  }
});

test('invalid providers are skipped without invented names or IDs', () => {
  const data = normalizeWatchProviders({ results: { IN: { flatrate: [null, {}, provider(0), provider(-1), provider(1.5), provider('bad'), provider(8, ''), provider(9, '  '), provider(10, 'Verified name')] } } }, 'IN');
  assert.deepEqual(Array.from(data.flatrate, item => item.id), [10]);
});

test('missing or unsafe destinations never become fabricated provider playback links', () => {
  for (const destination of [undefined, 'javascript:alert(1)', 'http://www.themoviedb.org/movie/1/watch', 'https://www.themoviedb.org.evil.test/movie/1/watch', 'https://www.themoviedb.org/movie/1', 'https://user:pass@www.themoviedb.org/movie/1/watch']) {
    const data = normalizeWatchProviders({ results: { IN: { link: destination, rent: [provider(2)] } } }, 'IN');
    assert.equal(data.link, undefined);
    assert.equal(data.rent.length, 1, 'Metadata stays available even when no safe link exists');
  }
});

test('movie and TV provider calls use existing cached server API and propagate failures', async () => {
  const calls = [];
  const mock = loadTypescript({ process: { env: { TMDB_API_KEY: 'test-only' } }, fetch: async (url, options) => {
    calls.push({ path: url.pathname, options });
    return Response.json(payload);
  } })('lib/tmdb.ts');
  for (const type of ['movie', 'tv']) {
    const result = await mock.getWatchProviders(type, 1, 'IN');
    assert.equal(result.data.link, link('IN'));
    assert.equal(calls.at(-1).path, `/3/${type}/1/watch/providers`);
    assert.equal(calls.at(-1).options.cache, 'force-cache');
    assert.ok(calls.at(-1).options.next.revalidate > 0);
  }
  assert.equal((await mock.getWatchProviders('movie', -1, 'IN')).error, 'not-found');
  assert.equal(calls.length, 2);
  for (const [body, status, expected] of [[{}, 200, 'upstream'], [{}, 401, 'unauthorized'], [{}, 404, 'not-found']]) {
    const service = loadTypescript({ process: { env: { TMDB_API_KEY: 'test-only' } }, fetch: async () => Response.json(body, { status }) })('lib/tmdb.ts');
    const result = await service.getWatchProviders('movie', 1, 'IN');
    assert.equal(result.error, expected);
    assert.equal(result.data, undefined);
  }
});
