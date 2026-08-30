// src/app/discover/page.jsx - Fixed
import Link from "next/link";
import Header from "@/components/Header";
import ContinueWatching from "@/components/ContinueWatching";
import TrendingShelf from "@/components/TrendingShelf";
import { getPopularMovies, getPopularTv, getTrending } from "@/lib/api";

export const revalidate = 600;

export default async function DiscoverPage() {
  const [popularMovies, popularTv, trending] = await Promise.all([
    getPopularMovies().catch(() => []),
    getPopularTv().catch(() => []),
    getTrending().catch(() => []),
  ]);

  return (
    <main className="siteShell">
      <Header />
      
      <section className="listing">
        <p className="eyebrow">THE GREED INDEX</p>
        <h1>What&apos;s on<br /><em>your list?</em></h1>
        
        <form className="searchForm" action="/search">
          <input name="q" placeholder="Search shows, movies, or genres" />
          <button className="button buttonLight">Search ↗</button>
        </form>

        <ContinueWatching />
        <TrendingShelf items={trending || []} />
        <Shelf title="Popular Movies" items={popularMovies || []} movie />
        <Shelf title="Popular TV Shows" items={popularTv || []} />
      </section>
    </main>
  );
}

function Shelf({ title, items, movie = false }) {
  if (!items || items.length === 0) return null;
  
  return (
    <section className="shelf">
      <div className="shelfHead">
        <h2>{title}</h2>
        <Link href="/popular">View all ↗</Link>
      </div>
      <div className="catalogGrid">
        {items.slice(0, 8).map(item => (
          <Link 
            key={item.id}
            href={`/show/${item.id}?type=${movie ? 'movie' : (item.media_type || 'tv')}`}
            className="catalogItem"
          >
            <div className="catalogPoster">
              {item.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt={item.title || item.name} loading="lazy" />
              ) : (
                <div className="noPoster">🎬</div>
              )}
              <span className="cardScore">★ {item.vote_average?.toFixed(1) || "—"}</span>
            </div>
            <h3>{item.title || item.name}</h3>
            <p>{(item.release_date || item.first_air_date || '').slice(0, 4)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}