export type MediaType = "movie" | "tv";

export type Media = { id:number; mediaType:MediaType; title:string; overview:string; posterPath?:string; backdropPath?:string; releaseDate?:string; popularity?:number; originCountries?:string[]; rating:number; voteCount:number; genreIds:number[] };
export type Provider = { id:number; name:string; logoPath?:string };
export type WatchProviders = { link?:string; flatrate:Provider[]; rent:Provider[]; buy:Provider[]; free:Provider[]; ads:Provider[] };

export const imageUrl = (path?: string, size = "w500") => path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
