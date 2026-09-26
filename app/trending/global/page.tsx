import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { GlobalTrendingPage } from "@/components/global-trending-page";
import { getGlobalTrending } from "@/lib/tmdb";

export const metadata = { title: "Global Trending | iFynex", description: "Movies and TV shows trending worldwide this week on TMDB." };

export default async function GlobalTrending({ searchParams }: { searchParams: Promise<{ type?: string | string[]; page?: string | string[] }> }) {
  const { type, page: requestedPage } = await searchParams;
  const filter = type === "movie" || type === "tv" ? type : "all";
  const page = typeof requestedPage === "string" && /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  const result = await getGlobalTrending(filter, page);
  return <><Navbar /><GlobalTrendingPage filter={filter} movies={result.data?.items ?? []} page={result.data?.page ?? 1} totalPages={result.data?.totalPages ?? 1} error={Boolean(result.error)} /><Footer /></>;
}
