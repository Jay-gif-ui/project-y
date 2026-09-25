import "server-only";
import { DISCOVERY_CONFIG } from "@/data/discovery-config";
import { INDIA_TRENDING } from "@/data/india-trending";
import { mergeIndiaTrending } from "@/lib/india-trending";
import { relevantReleasedTitle } from "@/lib/release-metadata";
import { isEnabledCountryCode } from "@/lib/countries";
import { discoveryParams, rankDiscovery, type DiscoveryCandidate, type DiscoveryPeriod, type Genre } from "@/lib/discovery";
import { COUNTRY_POOL_PAGES, COUNTRY_TREND_PROBE_LIMIT, countryPageSlice, countryTrendingDates, countryTrendingParams, mediaKey, rankCountryDiscovery, selectCountryMix, type CountryCandidate, type CountryMediaFilter, type CountryPeriod, type CountrySort, type CountrySurface } from "@/lib/country-trending";
import { type Media, type MediaType, type Provider, type WatchProviders } from "@/lib/media";

export { imageUrl, type Media, type MediaType, type Provider, type WatchProviders } from "@/lib/media";

export type TmdbResult<T> = { data:T; partial?:boolean; error?:never } | { data?:never; partial?:never; error:"not-configured"|"not-found"|"unauthorized"|"upstream" };
export type Person = { id:number; name:string; role:string; profilePath?:string };
export type Video = { id:string; name:string; key:string; site:"YouTube"; type:string; official:boolean };
export type Review = { id:string; author:string; content:string; createdAt?:string; url?:string };
export type TitleDetails = Media & { originalTitle?:string; tagline?:string; runtime?:number; genres:string[]; originalLanguage?:string; countries:string[]; companies:string[]; status?:string; budget?:number; revenue?:number; imdbId?:string; cast:Person[]; crew:Person[]; videos:Video[]; recommendations:Media[]; similar:Media[]; reviews:Review[] };
const API = "https://api.themoviedb.org/3";
const key = () => process.env.TMDB_API_KEY?.trim();
const REQUEST_TIMEOUT_MS = 10_000;
type Diagnostic = { name:string; endpoint:string; success:boolean; status:number|null; durationMs:number; hasResults:boolean; resultCount:number; error?:"not-configured"|"timeout"|"network"|"invalid-response"|"http" };
function toMedia(raw: Record<string, unknown>, explicitType?: MediaType): Media { const mediaType=explicitType ?? (raw.media_type === "tv" ? "tv" : "movie"); return { id:Number(raw.id), mediaType, title:String(mediaType === "tv" ? raw.name ?? "Untitled series" : raw.title ?? "Untitled movie"), overview:String(raw.overview ?? ""), posterPath:typeof raw.poster_path === "string" ? raw.poster_path : undefined, backdropPath:typeof raw.backdrop_path === "string" ? raw.backdrop_path : undefined, releaseDate:String(mediaType === "tv" ? raw.first_air_date ?? "" : raw.release_date ?? "") || undefined, popularity:Math.max(0, Number(raw.popularity) || 0), originCountries:originCountries(raw), rating:Number(raw.vote_average ?? 0), voteCount:Number(raw.vote_count ?? 0), genreIds:Array.isArray(raw.genre_ids) ? raw.genre_ids.map(Number) : [] }; }
const wait=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function request<T>(path:string, params:Record<string,string> = {}, revalidate: number=DISCOVERY_CONFIG.cacheSeconds):Promise<TmdbResult<T>> { const apiKey=key(); if(!apiKey)return{error:"not-configured"}; const url=new URL(`${API}${path}`); Object.entries({...params,api_key:apiKey,include_adult:"false"}).forEach(([name,value])=>url.searchParams.set(name,value)); for(let attempt=0;attempt<3;attempt+=1){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);try { const response=await fetch(url,{cache:"force-cache",next:{revalidate},signal:controller.signal}); if(response.status===401||response.status===403)return{error:"unauthorized"}; if(response.status===404)return{error:"not-found"}; if(response.ok){const json=await response.json();if(json&&typeof json==="object")return{data:json as T};} if(response.status<500&&response.status!==429)return{error:"upstream"}; } catch { /* Retry transient network failures and timeouts. */ } finally { clearTimeout(timeout); } if(attempt<2)await wait(350*(attempt+1)); } return{error:"upstream"}; }
function originCountries(raw: Record<string, unknown>): string[] {
  const origin = Array.isArray(raw.origin_country) ? raw.origin_country.filter((value): value is string => typeof value === "string") : [];
  const production = list(raw.production_countries).map(item => item.iso_3166_1).filter((value): value is string => typeof value === "string");
  return [...new Set([...origin, ...production].filter(code => /^[A-Z]{2}$/.test(code)))];
}

type RawCollection = { results?: Record<string, unknown>[]; total_pages?: number };

async function requestMedia(path: string, type: MediaType, params: Record<string, string> = {}): Promise<TmdbResult<Media[]> & { totalPages?: number }> {
  const result = await request<RawCollection>(path, params);
  if (!result.data) return { error: result.error };
  if (!Array.isArray(result.data.results)) return { error: "upstream" };
  return { data: result.data.results.filter(item => item.adult !== true).map(item => toMedia(item, type)), totalPages: result.data.total_pages ?? 1 };
}

export async function getCollection(type: MediaType, collection: "popular" | "top_rated" | "trending", region?: string): Promise<TmdbResult<Media[]>> {
  const normalizedRegion = region?.toUpperCase();
  const path = collection === "trending" ? `/trending/${type}/week` : `/${type}/${collection}`;
  // Global trending order is preserved. No country filter or freshness re-ranking here.
  return requestMedia(path, type, { language: "en-US", ...(type === "movie" && collection === "popular" && isEnabledCountryCode(normalizedRegion) ? { region: normalizedRegion } : {}) });
}

export async function getGenres(type: MediaType): Promise<TmdbResult<Genre[]>> {
  const result = await request<{ genres?: Genre[] }>(`/genre/${type}/list`, { language: "en-US" }, 86400);
  if (!result.data) return { error: result.error };
  if (!Array.isArray(result.data.genres)) return { error: "upstream" };
  return { data: result.data.genres.filter(genre => Number.isSafeInteger(genre.id) && genre.id > 0 && typeof genre.name === "string") };
}

export type CountryDiscoveryData = { items: Media[]; localIds: string[]; localTotal: number; internationalTotal: number; total: number; page: number; totalPages: number };
type CountryTrends = { movie: Promise<TmdbResult<Media[]>>; tv: Promise<TmdbResult<Media[]>> };

export async function getDailyTrending(type: MediaType): Promise<TmdbResult<Media[]>> {
  return requestMedia(`/trending/${type}/day`, type, { language: "en-US" });
}

// Pages are cached by the existing server request helper and shared by home,
// filters and pagination. Stop at the source's end; never fetch a whole catalog.
async function countryPool(type: MediaType, region: string, now: Date, pool: keyof typeof COUNTRY_POOL_PAGES): Promise<{ data: Media[]; complete: boolean; error?: TmdbResult<Media[]>["error"] }> {
  const data: Media[] = [];
  for (let page = 1; page <= COUNTRY_POOL_PAGES[pool]; page++) {
    const result = await requestMedia(`/discover/${type}`, type, countryTrendingParams(type, region, now, pool, page));
    if (!result.data) return { data, complete: false, error: result.error };
    data.push(...result.data);
    if (!result.data.length || page >= (result.totalPages ?? 1)) return { data, complete: true };
  }
  return { data, complete: false };
}

async function verifyCountryTrend(media: Media, region: string): Promise<{ media: Media; available: boolean; error?: TmdbResult<Media[]>["error"] }> {
  // One bounded detail request supplies both real origin and real watch offers.
  const result = await request<Record<string, unknown>>(`/${media.mediaType}/${media.id}`, { language: "en-US", append_to_response: "watch/providers" });
  if (!result.data) return { media, available: false, error: result.error };
  const providers = result.data["watch/providers"] as { results?: Record<string, Record<string, unknown>> } | undefined;
  const offers = providers?.results?.[region];
  return { media: { ...media, originCountries: originCountries(result.data) }, available: Boolean(offers && ["flatrate", "free", "ads", "rent", "buy"].some(kind => providerList(offers[kind]).length)) };
}

export async function getCountryDiscovery(region: string, options: { surface?: CountrySurface; filter?: CountryMediaFilter; sort?: CountrySort; period?: CountryPeriod; page?: number; origin?: "all" | "local" } = {}, trends?: CountryTrends, now = new Date()): Promise<TmdbResult<CountryDiscoveryData>> {
  const normalizedRegion = region.toUpperCase();
  if (!isEnabledCountryCode(normalizedRegion)) return { error: "not-found" };
  if (normalizedRegion === "IN") return getIndiaDiscovery(options, trends, now);
  const surface = options.surface ?? "home";
  const filter = options.filter ?? "all";
  const types: MediaType[] = filter === "all" ? ["movie", "tv"] : [filter];
  const { today, year } = countryTrendingDates(now);
  const pools = await Promise.all(types.map(async type => {
    const [localRecent, internationalRecent, localActivity, internationalActivity, trending, daily] = await Promise.all([
      countryPool(type, normalizedRegion, now, "local"),
      countryPool(type, normalizedRegion, now, "international"),
      countryPool(type, normalizedRegion, now, "activity"),
      countryPool(type, normalizedRegion, now, "international-activity"),
      trends?.[type] ?? getCollection(type, "trending"),
      getDailyTrending(type),
    ]);
    const results = [localRecent, internationalRecent, localActivity, internationalActivity, trending, daily];
    // An upstream outage is explicit, never silently replaced by a global chart.
    if (!localRecent.data.length && !localActivity.data.length && localRecent.error && localActivity.error) return { picks: [], candidates: [], results };
    const localKeys = new Set([...localRecent.data, ...localActivity.data].map(mediaKey));
    const classify = (media: Media) => {
      if (localKeys.has(mediaKey(media)) || media.originCountries?.includes(normalizedRegion)) return true;
      if (media.originCountries?.length) return false;
      // Movie Discover lacks origin metadata. Absence proves nonlocal ONLY when
      // the identical, origin-filtered recent query was completely exhausted.
      // Activity movies have a narrower date window within that same query.
      if (type === "movie" && localRecent.complete) return false;
      return undefined;
    };
    const candidates: CountryCandidate[] = [
      ...(localRecent.data ?? []).map(media => ({ media, available: true, local: true })),
      ...(localActivity.data ?? []).map(media => ({ media, available: true, local: true, recentlyAired: type === "tv" })),
      ...internationalRecent.data.map(media => ({ media, available: true, local: classify(media) })),
      ...internationalActivity.data.map(media => ({ media, available: true, local: classify(media), recentlyAired: type === "tv" })),
    ];
    // Genuine daily/weekly trends can resurface at any age. Only a bounded set absent
    // from Discover needs provider checks; never assume regional availability.
    const seen = new Set(candidates.filter(candidate => candidate.local !== undefined).map(candidate => mediaKey(candidate.media)));
    const feed = [...(daily.data ?? []), ...(trending.data ?? []), ...candidates.filter(candidate => candidate.local === undefined).map(candidate => candidate.media)];
    const missing = feed.filter(media => {
      if (seen.has(mediaKey(media)) || !media.releaseDate || media.releaseDate > today) return false;
      seen.add(mediaKey(media));
      return true;
    }).slice(0, COUNTRY_TREND_PROBE_LIMIT);
    const verified = await Promise.all(missing.map(media => verifyCountryTrend(media, normalizedRegion)));
    candidates.push(...verified.map(({ media, available }) => ({ media, available })));
    for (const item of verified) if (item.error) results.push({ error: item.error });
    return { picks: rankCountryDiscovery(candidates, trending.data ?? [], normalizedRegion, now, { daily: daily.data ?? [] }), candidates, results };
  }));
  const withinPeriod = (pick: { media: Media; local: boolean }) => (options.period !== "year" || pick.media.releaseDate!.startsWith(String(year))) && (options.origin !== "local" || pick.local);
  const selection = selectCountryMix(pools.flatMap(pool => pool.picks).filter(withinPeriod), options);
  const { page, totalPages, items } = countryPageSlice(selection, surface === "home" ? 1 : options.page, options.origin);
  const visible = surface === "home" ? selection.home : items;
  const error = pools.flatMap(pool => pool.results).find(result => result.error)?.error;
  if (!selection.all.length && error) return { error };
  return { data: { items: visible.map(pick => pick.media), localIds: visible.filter(pick => pick.local).map(pick => mediaKey(pick.media)), localTotal: selection.localTotal, internationalTotal: selection.internationalTotal, total: selection.all.length, page, totalPages }, partial: Boolean(error) };
}

// All discovery surfaces share these exact cached detail URLs. No runtime searches.
type DiscoveryMetadata = TmdbResult<{ media: Media; raw: Record<string, unknown> }>;
const pendingMetadata = new Map<string, Promise<DiscoveryMetadata>>();
export function getDiscoveryMetadata(type: MediaType, id: number): Promise<DiscoveryMetadata> {
  const identity = `${type}:${id}`;
  const pending = pendingMetadata.get(identity);
  if (pending) return pending;
  const result = fetchDiscoveryMetadata(type, id).finally(() => pendingMetadata.delete(identity));
  pendingMetadata.set(identity, result);
  return result;
}
async function fetchDiscoveryMetadata(type: MediaType, id: number): Promise<DiscoveryMetadata> {
  if (!Number.isSafeInteger(id) || id < 1) return { error: "not-found" };
  const result = await request<Record<string, unknown>>(`/${type}/${id}`, { language: "en-US", append_to_response: type === "movie" ? "watch/providers,release_dates" : "watch/providers" });
  if (!result.data) return { error: result.error };
  if (result.data.adult === true || Number(result.data.id) !== id) return { error: "not-found" };
  return { data: { media: toMedia(result.data, type), raw: result.data } };
}
export async function getReleaseSource(type: MediaType, params: Record<string, string>) {
  return requestMedia(`/discover/${type}`, type, params);
}

async function getIndiaDiscovery(options: { surface?: CountrySurface; filter?: CountryMediaFilter; sort?: CountrySort; period?: CountryPeriod; page?: number; origin?: "all" | "local" }, trends: CountryTrends | undefined, now: Date): Promise<TmdbResult<CountryDiscoveryData>> {
  const types: MediaType[] = options.filter && options.filter !== "all" ? [options.filter] : ["movie", "tv"];
  const { today, year } = countryTrendingDates(now);
  const configured = INDIA_TRENDING.titles.slice(0, DISCOVERY_CONFIG.indiaManualLimit).filter(entry => types.includes(entry.type));
  const manualPromise = Promise.all(configured.map(entry => getDiscoveryMetadata(entry.type, entry.id)));
  const feeds = await Promise.all(types.map(async type => {
    const [daily, weekly] = await Promise.all([getDailyTrending(type), trends?.[type] ?? getCollection(type, "trending")]);
    const unique = new Map<string, Media>();
    // Interleave before the budget so a full daily feed cannot starve weekly trends.
    for (let index = 0; index < Math.max(daily.data?.length ?? 0, weekly.data?.length ?? 0); index++) {
      for (const [media, signal] of [[daily.data?.[index], "daily-trend"], [weekly.data?.[index], "weekly-trend"]] as const) {
        if (media?.releaseDate && media.releaseDate <= today && !unique.has(mediaKey(media))) unique.set(mediaKey(media), { ...media, discoverySignal: signal });
      }
    }
    return { items: [...unique.values()].slice(0, DISCOVERY_CONFIG.indiaGlobalProbesPerType), errors: [daily.error, weekly.error].filter(Boolean) };
  }));
  const manualResults = await manualPromise;
  const details = new Map(configured.map((entry, index) => [`${entry.type}:${entry.id}`, manualResults[index]]));
  const globalItems = feeds.flatMap(feed => feed.items);
  await Promise.all(globalItems.map(async media => {
    if (!details.has(mediaKey(media))) details.set(mediaKey(media), await getDiscoveryMetadata(media.mediaType, media.id));
  }));
  const manual = configured.flatMap(entry => {
    const result = details.get(`${entry.type}:${entry.id}`);
    return result?.data && relevantReleasedTitle(result.data.media, result.data.raw, "IN", today, true) ? [result.data.media] : [];
  });
  const global = globalItems.flatMap(item => {
    const result = details.get(mediaKey(item));
    return result?.data && relevantReleasedTitle(result.data.media, result.data.raw, "IN", today) ? [{ ...result.data.media, discoverySignal: item.discoverySignal }] : [];
  });
  const all = mergeIndiaTrending(manual, global, now, options.sort).filter(media => (options.period !== "year" || media.releaseDate?.startsWith(String(year))) && (options.origin !== "local" || media.originCountries?.includes("IN")));
  const error = [...feeds.flatMap(feed => feed.errors), ...[...details.values()].map(result => result.error)].find(Boolean);
  if (!all.length && error) return { error };
  const totalPages = Math.max(1, Math.ceil(all.length / DISCOVERY_CONFIG.pageSize));
  const page = options.surface !== "browse" ? 1 : Math.max(1, Math.min(totalPages, Number.isSafeInteger(options.page) ? options.page! : 1));
  const items = all.slice((page - 1) * DISCOVERY_CONFIG.pageSize, page * DISCOVERY_CONFIG.pageSize);
  const local = (media: Media) => Boolean(media.originCountries?.includes("IN")), localTotal = all.filter(local).length;
  return { data: { items, localIds: items.filter(local).map(mediaKey), localTotal, internationalTotal: all.length - localTotal, total: all.length, page, totalPages }, partial: Boolean(error) };
}

export async function getPopularAvailableInRegion(region: string, trends: { movie: Promise<TmdbResult<Media[]>>; tv: Promise<TmdbResult<Media[]>> }, now = new Date()): Promise<TmdbResult<Media[]>> {
  const result = await getCountryDiscovery(region, { surface: "home" }, trends, now);
  return result.data ? { data: result.data.items, partial: result.partial } : { error: result.error };
}


export async function discoverGenre(type: MediaType, region: string, genreId: number, period: DiscoveryPeriod, now = new Date()): Promise<TmdbResult<Media[]>> {
  const normalizedRegion = region.toUpperCase();
  if (!isEnabledCountryCode(normalizedRegion) || !Number.isSafeInteger(genreId) || genreId < 1) return { error: "not-found" };
  const genres = await getGenres(type);
  if (!genres.data) return { error: genres.error };
  if (!genres.data.some(genre => genre.id === genreId)) return { error: "not-found" };
  const [recent, activity, trending] = await Promise.all([
    requestMedia(`/discover/${type}`, type, discoveryParams(type, normalizedRegion, now, { genreId, period })),
    period === "year" ? Promise.resolve({ data: [] } as TmdbResult<Media[]>) : requestMedia(`/discover/${type}`, type, discoveryParams(type, normalizedRegion, now, { genreId, activity: true })),
    getCollection(type, "trending"),
  ]);
  const candidates: DiscoveryCandidate[] = [
    ...(recent.data ?? []).map(media => ({ media })),
    ...(activity.data ?? []).map(media => ({ media, recentlyAired: type === "tv" })),
  ];
  const items = rankDiscovery(candidates.filter(({ media }) => media.genreIds.includes(genreId)), trending.data ?? [], now, { period });
  const error = [recent, activity, trending].find(result => result.error)?.error;
  if (!items.length && error) return { error };
  return { data: items, partial: Boolean(error) };
}

export async function searchMedia(query:string):Promise<TmdbResult<Media[]>> { const cleaned=query.trim(); if(!cleaned)return{data:[]}; const result=await request<{results?:Record<string,unknown>[] }>("/search/multi",{query:cleaned,language:"en-US"}); if("data"in result&&result.data)return{data:(result.data.results??[]).filter(item=>item.media_type==="movie"||item.media_type==="tv").map(item=>toMedia(item))}; return result; }
function list(raw:unknown):Record<string,unknown>[] { return Array.isArray(raw) ? raw.filter((item):item is Record<string,unknown> => Boolean(item) && typeof item === "object") : []; }
function namedList(raw:unknown):string[] { return Array.isArray(raw) ? raw.map(item => typeof item === "string" ? item : item && typeof item === "object" && typeof (item as Record<string,unknown>).name === "string" ? String((item as Record<string,unknown>).name) : "").filter(Boolean) : []; }
function providerList(raw:unknown):Provider[] { return list(raw).map(item => ({ id:Number(item.provider_id), name:String(item.provider_name ?? "Provider"), logoPath:typeof item.logo_path === "string" ? item.logo_path : undefined })).filter(item => Number.isFinite(item.id)); }
function normalizeDetails(raw:Record<string,unknown>, type:MediaType):TitleDetails { const media=toMedia(raw,type); const credits=(raw.credits && typeof raw.credits === "object" ? raw.credits : {}) as Record<string,unknown>; const videos=(raw.videos && typeof raw.videos === "object" ? raw.videos : {}) as Record<string,unknown>; const recommendations=(raw.recommendations && typeof raw.recommendations === "object" ? raw.recommendations : {}) as Record<string,unknown>; const similar=(raw.similar && typeof raw.similar === "object" ? raw.similar : {}) as Record<string,unknown>; const reviews=(raw.reviews && typeof raw.reviews === "object" ? raw.reviews : {}) as Record<string,unknown>; const people=(items:unknown, roleKey:"character"|"job") => list(items).slice(0,14).map(item => ({id:Number(item.id),name:String(item.name ?? "Unknown"),role:String(item[roleKey] ?? ""),profilePath:typeof item.profile_path === "string" ? item.profile_path : undefined})).filter(item=>Number.isFinite(item.id)); const crew=people(credits.crew,"job").filter(person=>["Director","Writer","Screenplay","Producer","Executive Producer","Creator"].includes(person.role)).slice(0,8); return {...media, originalTitle:typeof (type === "tv" ? raw.original_name : raw.original_title) === "string" ? String(type === "tv" ? raw.original_name : raw.original_title) : undefined, tagline:typeof raw.tagline === "string" ? raw.tagline : undefined, runtime:Number(type === "tv" ? list(raw.episode_run_time)[0] : raw.runtime) || undefined, genres:namedList(raw.genres), originalLanguage:typeof raw.original_language === "string" ? raw.original_language.toUpperCase() : undefined, countries:namedList(type === "tv" ? raw.origin_country : raw.production_countries), companies:namedList(raw.production_companies), status:typeof raw.status === "string" ? raw.status : undefined, budget:Number(raw.budget) || undefined, revenue:Number(raw.revenue) || undefined, imdbId:typeof raw.imdb_id === "string" ? raw.imdb_id : undefined, cast:people(credits.cast,"character"), crew, videos:list(videos.results).filter(item=>item.site === "YouTube" && typeof item.key === "string").map(item=>({id:String(item.id),name:String(item.name ?? "Video"),key:String(item.key),site:"YouTube" as const,type:String(item.type ?? "Video"),official:item.official === true})).slice(0,8), recommendations:list(recommendations.results).map(item=>toMedia(item,type)).slice(0,12), similar:list(similar.results).map(item=>toMedia(item,type)).slice(0,12), reviews:list(reviews.results).slice(0,3).map(item=>({id:String(item.id),author:String(item.author ?? "TMDB member"),content:String(item.content ?? ""),createdAt:typeof item.created_at === "string" ? item.created_at : undefined,url:typeof item.url === "string" ? item.url : undefined}))}; }
export async function getTitleDetails(type:MediaType, id:number):Promise<TmdbResult<TitleDetails>> { if(!Number.isSafeInteger(id)||id<1)return{error:"not-found"}; const result=await request<Record<string,unknown>>(`/${type}/${id}`,{language:"en-US",append_to_response:"credits,videos,recommendations,similar,reviews,external_ids"}); return "data" in result && result.data ? {data:normalizeDetails(result.data,type)} : result; }
export async function getWatchProviders(type:MediaType, id:number, region:string):Promise<TmdbResult<WatchProviders>> { if(!Number.isSafeInteger(id)||id<1)return{error:"not-found"}; const normalizedRegion=region.toUpperCase(); if(!/^[A-Z]{2}$/.test(normalizedRegion))return{error:"not-found"}; const result=await request<Record<string,unknown>>(`/${type}/${id}/watch/providers`); if(!("data" in result) || !result.data)return result; const allResults=result.data.results; const item=allResults && typeof allResults === "object" ? (allResults as Record<string,unknown>)[normalizedRegion] : undefined; if(!item || typeof item !== "object")return{data:{flatrate:[],rent:[],buy:[],free:[],ads:[]}}; const values=item as Record<string,unknown>; return{data:{link:typeof values.link === "string" ? values.link : undefined,flatrate:providerList(values.flatrate),rent:providerList(values.rent),buy:providerList(values.buy),free:providerList(values.free),ads:providerList(values.ads)}}; }
export async function diagnoseCollections():Promise<Diagnostic[]>{const targets=[{name:"Trending Movies",endpoint:"/trending/movie/week"},{name:"Popular Movies",endpoint:"/movie/popular"},{name:"Top Rated Movies",endpoint:"/movie/top_rated"},{name:"Popular TV Shows",endpoint:"/tv/popular"},{name:"Trending TV Shows",endpoint:"/trending/tv/week"}];const apiKey=key();if(!apiKey)return targets.map(target=>({...target,success:false,status:null,durationMs:0,hasResults:false,resultCount:0,error:"not-configured" as const}));return Promise.all(targets.map(async target=>{const started=Date.now(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);const url=new URL(`${API}${target.endpoint}`);url.searchParams.set("api_key",apiKey);url.searchParams.set("language","en-US");try{const response=await fetch(url,{cache:"no-store",signal:controller.signal});const durationMs=Date.now()-started;if(!response.ok)return{...target,success:false,status:response.status,durationMs,hasResults:false,resultCount:0,error:"http" as const};const body=await response.json() as {results?:unknown};const count=Array.isArray(body?.results)?body.results.length:0;return{...target,success:true,status:response.status,durationMs,hasResults:count>0,resultCount:count};}catch(error){const durationMs=Date.now()-started;return{...target,success:false,status:null,durationMs,hasResults:false,resultCount:0,error:(error instanceof DOMException&&error.name==="AbortError"?"timeout":"network") as "timeout"|"network"};}finally{clearTimeout(timeout);}}));}
