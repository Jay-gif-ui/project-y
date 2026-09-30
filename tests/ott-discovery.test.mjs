import { test } from 'node:test';
import assert from 'node:assert/strict';
import loadTypescript from './load-typescript.mjs';
const now = new Date('2026-09-29T12:00:00Z');
const countries = ['IN', 'GB', 'US'];
const raw = (id, type = 'movie') => ({ id, [type === 'movie' ? 'title' : 'name']: `Fixture ${id}`, [type === 'movie' ? 'release_date' : 'first_air_date']: '2026-08-01', vote_average: 7, popularity: 100 });
const provider = (id, name = 'Netflix') => ({ provider_id: id, provider_name: name, logo_path: '/logo.jpg' });
function service(responder) {
  const calls = [];
  const load = loadTypescript({ process: { env: { TMDB_API_KEY: 'test-only' } }, fetch: async url => {
    calls.push({ path: url.pathname, params: Object.fromEntries(url.searchParams) });
    return responder(url);
  }});
  return { api: load('lib/ott-discovery.ts'), tmdb: load('lib/tmdb.ts'), calls };
}

test('only the three enabled markets are exposed; profile country beats signup and guest preferences', () => {
  const { ENABLED_COUNTRIES, resolveAccountCountry, getCountry } = loadTypescript()('lib/countries.ts');
  assert.deepEqual(Array.from(ENABLED_COUNTRIES, country => country.code), countries);
  assert.equal(resolveAccountCountry('GB', 'IN'), 'GB');
  assert.equal(resolveAccountCountry(null, 'US'), 'US');
  assert.equal(resolveAccountCountry('CA', 'IN'), 'IN');
  assert.equal(resolveAccountCountry(null, null), null);
  assert.equal(getCountry('CA').code, 'IN');
});

test('Netflix discoveries differ by country and never include rental-only or foreign offers', async () => {
  const { api, calls } = service(url => {
    const type = url.pathname.includes('/tv') ? 'tv' : 'movie';
    if (url.pathname.includes('/watch/providers/')) return Response.json({ results: [provider(8), provider(1796, 'Netflix Standard with Ads')] });
    if (url.pathname.includes('/discover/')) {
      const region = url.searchParams.get('watch_region');
      return Response.json({ results: [raw(100 + countries.indexOf(region), type)] });
    }
    if (url.pathname.includes('/trending/')) return Response.json({ results: [raw(1, type), raw(2, type), raw(3, type), raw(4, type)] });
    const id = Number(url.pathname.split('/')[3]);
    return Response.json({ results: Object.fromEntries(countries.map((region, index) => [region, {
      ...(id === index + 1 ? { flatrate: [provider(8)] } : {}),
      ...(id === 4 ? { rent: [provider(8)] } : {}),
    }])) });
  });
  for (const [index, country] of countries.entries()) {
    const result = await api.getPlatformDiscovery('netflix', country, now);
    assert.equal(result.error, undefined);
    assert.deepEqual(Array.from(result.data.trendingMovies, item => item.id), [index + 1]);
    assert.deepEqual(Array.from(result.data.trendingShows, item => item.id), [index + 1]);
    assert.ok(result.data.popular.every(item => item.id === 100 + index));
  }
  const discovery = calls.filter(call => call.path.includes('/discover/'));
  assert.equal(discovery.length, 6);
  for (const call of discovery) {
    assert.ok(countries.includes(call.params.watch_region));
    assert.equal(call.params.with_watch_providers, '8|1796');
    assert.equal(call.params.with_watch_monetization_types, 'flatrate|free|ads');
    assert.equal(call.params.sort_by, 'popularity.desc');
  }
});

test('regional provider catalogue combines movies and TV without inventing unavailable platforms', async () => {
  const { tmdb, calls } = service(url => Response.json({ results: url.pathname.endsWith('/movie') ? [provider(119, 'Amazon Prime Video'), provider(8)] : [provider(337, 'Disney Plus'), provider(8)] }));
  const result = await tmdb.getRegionalPlatforms('GB');
  assert.deepEqual(Array.from(result.data, item => item.slug), ['netflix', 'amazon-prime-video', 'disney-plus']);
  assert.deepEqual(Array.from(result.data[1].providerIds.tv), []);
  assert.equal(result.data[2].providerIds.tv[0], 337);
  assert.ok(calls.every(call => call.params.watch_region === 'GB'));
});

test('empty platform and error states never fall back to a global catalogue', async () => {
  const empty = service(() => Response.json({ results: [] }));
  const missing = await empty.api.getPlatformDiscovery('netflix', 'IN', now);
  assert.equal(missing.data.platform, null);
  assert.equal(missing.data.popular.length, 0);
  assert.equal(empty.calls.length, 2);
  const outage = service(() => Response.json({}, { status: 401 }));
  assert.equal((await outage.api.getPlatformDiscovery('netflix', 'US', now)).error, 'unauthorized');
  const invalid = service(() => { throw new Error('Should not fetch'); });
  assert.equal((await invalid.api.getPlatformDiscovery('netflix', 'CA', now)).error, 'not-found');
  assert.equal(invalid.calls.length, 0);
});

test('free and ad-supported variants qualify, while rent and buy do not', () => {
  const { hasPlatformSubscription } = loadTypescript()('lib/ott.ts');
  const offers = { flatrate: [], ads: [], free: [], rent: [{ id: 8 }], buy: [{ id: 8 }] };
  assert.equal(hasPlatformSubscription(offers, [8]), false);
  offers.ads = [{ id: 1796 }];
  assert.equal(hasPlatformSubscription(offers, [8,1796]), true);
  assert.equal(hasPlatformSubscription(offers, [119]), false);
});
