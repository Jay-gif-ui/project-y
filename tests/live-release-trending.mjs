// Opt-in: node --env-file=.env.local tests/live-release-trending.mjs
// Uses real responses; writes no credentials or fabricated provider destinations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import loadTypescript from './load-typescript.mjs';

const cache = new Map(), source = new Map(), failures = [], actualFetch = globalThis.fetch;
async function auditedFetch(url, options) {
  const address = String(url);
  if (!cache.has(address)) cache.set(address, (async () => {
    const response = await actualFetch(url, options), body = await response.json();
    const parsed = new URL(address);
    source.set(`${parsed.pathname}?page=${parsed.searchParams.get('page') ?? '1'}`, body);
    if (!response.ok) { cache.delete(address); failures.push({ path: parsed.pathname, status: response.status }); }
    return { body, status: response.status };
  })());
  const result = await cache.get(address);
  return Response.json(result.body, { status: result.status });
}
const load = loadTypescript({ fetch: auditedFetch });
const tmdb = load('lib/tmdb.ts'), releases = load('lib/tmdb-releases.ts');
const { regionalMovieEvents } = load('lib/release-metadata.ts');
const { releaseDates } = load('lib/releases.ts');
const { providerAction } = load('lib/watch-providers.ts');
const now = new Date(), dates = releaseDates(now);
const identity = item => `${item.mediaType}:${item.id}`;
const report = { auditedAt: now.toISOString(), dates, network: process.env.DISCOVERY_AUDIT_DNS ?? 'system DNS', failures, countries: [], global: [], providers: [] };
const output = process.env.DISCOVERY_AUDIT_OUTPUT ?? 'docs/release-trending-live-audit.json';
const check = (result, label) => { assert.ok(result.data, `${label}: ${result.error}`); return result.data; };
try {
  for (const region of ['IN', 'US', 'GB']) {
    const result = await releases.getCountryReleases(region, {}, now);
    const data = check(result, region);
    assert.ok(data.items.length, `${region}: expected releases`);
    const upcomingResult = await releases.getCountryReleases(region, { status: 'upcoming' }, now);
    const upcoming = check(upcomingResult, `${region} upcoming`);
    assert.ok(upcoming.items.every(item => item.releaseEvent.status === 'upcoming' && item.releaseEvent.date > dates.today));
    for (const item of [...data.items, ...upcoming.items]) {
      const event = item.releaseEvent;
      assert.ok(event.date >= dates.recentStart && event.date <= dates.upcomingEnd);
      assert.equal(event.status, event.date > dates.today ? 'upcoming' : 'released');
      if (item.mediaType === 'movie') {
        const raw = source.get(`/3/movie/${item.id}?page=1`);
        assert.ok(regionalMovieEvents(raw, region).some(entry => entry.date === event.date && entry.kind === event.kind));
        assert.equal(event.regional, true);
      }
    }
    const sample = item => ({ id: item.id, type: item.mediaType, title: item.title, event: item.releaseEvent, availability: item.releaseAvailability });
    report.countries.push({ region, total: data.total, partial: Boolean(result.partial), upcomingTotal: upcoming.total, upcomingPartial: Boolean(upcomingResult.partial), samples: data.items.map(sample), upcomingSamples: upcoming.items.map(sample) });
    console.log(JSON.stringify({ region, releases: data.total, upcoming: upcoming.total, withoutOffers: data.items.filter(item => item.releaseAvailability === 'not-found').length }));
  }
  for (const type of ['all', 'movie', 'tv']) for (const page of [1, 2]) {
    const data = check(await tmdb.getGlobalTrending(type, page), `${type}/${page}`);
    const raw = source.get(`/3/trending/${type}/week?page=${page}`);
    const expected = raw.results.filter(item => item.adult !== true && ['movie','tv'].includes(type === 'all' ? item.media_type : type)).map(item => `${type === 'all' ? item.media_type : type}:${item.id}`);
    assert.deepEqual(Array.from(data.items, identity), [...new Set(expected)]);
    assert.equal(data.page, page);
    report.global.push({ type, page, totalPages: data.totalPages, items: Array.from(data.items, identity), upstreamOrderMatches: true });
  }
  for (const [type, id, region, expectedId] of [['movie',550,'IN',8], ['tv',76479,'IN',119], ['movie',550,'US',2]]) {
    const providers = check(await tmdb.getWatchProviders(type, id, region), `${type}/${id} providers`);
    const raw = source.get(`/3/${type}/${id}/watch/providers?page=1`).results[region];
    const offers = [];
    for (const group of ['flatrate','rent','buy','free','ads']) {
      assert.deepEqual(Array.from(providers[group], item => item.id), (raw[group] ?? []).map(item => item.provider_id));
      for (const item of providers[group]) {
        const action = providerAction(item, group), original = raw[group].find(entry => entry.provider_id === item.id);
        if (action) assert.ok([original.link,original.url].includes(action.href), 'Destination must be returned on this offer');
        offers.push({ group, id: item.id, name: item.name, destination: action?.href ?? null });
      }
    }
    assert.ok(offers.some(item => item.id === expectedId), `Expected provider ${expectedId} missing in sample`);
    report.providers.push({ type, id, region, offers });
  }
  report.result = 'passed';
  console.log('Live regional release, global trending order/pagination and provider checks passed.');
} catch (error) {
  report.result = 'failed'; report.failure = error.message; process.exitCode = 1;
  console.error(error.message);
} finally {
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}
