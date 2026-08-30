// src/app/anime/page.jsx - Fixed with background retry for failed fetches
import Link from 'next/link';
import Header from '@/components/Header';
import ScheduleView from '@/components/ScheduleView';

export const revalidate = 3600;

const ANILIST_API = 'https://graphql.anilist.co';

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('http');
}

function formatTimeAgo(unixSeconds) {
  if (!unixSeconds) return null;
  const diffMs = Date.now() - unixSeconds * 1000;
  if (diffMs < 0) return null;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Retry wrapper
async function fetchWithRetry(fetchFn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await fetchFn();
      if (result && result.length > 0) return result;
      
      // If empty result, wait and retry
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    } catch (error) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  return [];
}

async function fetchAnime(sortType) {
  const query = `
    query ($sort: [MediaSort]) {
      Page(page: 1, perPage: 20) {
        media(type: ANIME, sort: $sort, isAdult: false) {
          id
          title { romaji english native }
          coverImage { large extraLarge }
          averageScore
          episodes
          seasonYear
          format
          genres
          countryOfOrigin
          isAdult
        }
      }
    }
  `;

  const fetchFn = async () => {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { sort: [sortType] } }),
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];
    const data = await response.json();
    return (data?.data?.Page?.media || [])
      .filter(item => !item.isAdult)
      .map(item => ({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || item.title?.native || 'Unknown',
        image: item.coverImage?.extraLarge || item.coverImage?.large || null,
        score: item.averageScore ? (item.averageScore / 10).toFixed(1) : null,
        year: item.seasonYear || null,
        episodes: item.episodes || null,
        format: item.format || '',
        genres: item.genres || [],
      }));
  };

  return fetchWithRetry(fetchFn);
}

async function fetchRecentlyAired() {
  const query = `
    query {
      Page(page: 1, perPage: 30) {
        airingSchedules(sort: TIME_DESC, notYetAired: false) {
          episode
          airingAt
          media {
            id
            title { romaji english native }
            coverImage { large extraLarge }
            averageScore
            format
            seasonYear
            countryOfOrigin
            isAdult
          }
        }
      }
    }
  `;

  const fetchFn = async () => {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];
    const data = await response.json();
    const schedules = data?.data?.Page?.airingSchedules || [];

    const seenIds = new Set();
    const results = [];

    for (const entry of schedules) {
      const item = entry.media;
      if (!item || seenIds.has(item.id)) continue;
      if (item.isAdult) continue;
      
      const image = item.coverImage?.extraLarge || item.coverImage?.large;
      if (!isValidUrl(image)) continue;

      seenIds.add(item.id);
      results.push({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || 'Unknown',
        image,
        score: item.averageScore ? (item.averageScore / 10).toFixed(1) : null,
        year: item.seasonYear || null,
        format: item.format || '',
        episode: entry.episode || null,
        airedAgo: formatTimeAgo(entry.airingAt),
      });
    }

    return results;
  };

  return fetchWithRetry(fetchFn);
}

async function fetchWeekSchedule() {
  const now = Math.floor(Date.now() / 1000);
  const rangeStart = now - 60 * 60 * 24; // 1 day ago
  const rangeEnd = now + 60 * 60 * 24 * 6; // 6 days ahead

  const query = `
    query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 100) {
        airingSchedules(sort: TIME, airingAt_greater: $start, airingAt_lesser: $end) {
          episode
          airingAt
          media {
            id
            title { romaji english native }
            coverImage { large extraLarge }
            format
            countryOfOrigin
            isAdult
          }
        }
      }
    }
  `;

  const fetchFn = async () => {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { start: rangeStart, end: rangeEnd } }),
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];
    const data = await response.json();
    const schedules = data?.data?.Page?.airingSchedules || [];

    return schedules
      .filter(entry => {
        const item = entry.media;
        if (!item || item.isAdult) return false;
        const image = item.coverImage?.extraLarge || item.coverImage?.large;
        return isValidUrl(image);
      })
      .map(entry => ({
        id: `${entry.media.id}-${entry.episode}`,
        mediaId: String(entry.media.id),
        title: entry.media.title?.english || entry.media.title?.romaji || 'Unknown',
        image: entry.media.coverImage?.extraLarge || entry.media.coverImage?.large,
        format: entry.media.format || '',
        episode: entry.episode,
        airingAt: entry.airingAt,
      }));
  };

  return fetchWithRetry(fetchFn);
}

export default async function AnimePage() {
  const [trending, popular, recent, schedule] = await Promise.all([
    fetchAnime('TRENDING_DESC'),
    fetchAnime('POPULARITY_DESC'),
    fetchRecentlyAired(),
    fetchWeekSchedule(),
  ]);

  return (
    <main className="siteShell">
      <Header />
      
      <section className="listing">
        <div className="animeHero">
          <p className="eyebrow">THE GREED INDEX</p>
          <h1>Anime <em>Collection</em></h1>
          
          <form className="searchForm animeSearchForm" action="/anime/search">
            <input 
              name="q" 
              placeholder="Search anime..." 
              autoComplete="off"
              className="animeSearchInput"
            />
            <button type="submit" className="button buttonLight">
              🔍 Search
            </button>
          </form>
        </div>

        <AnimeShelf title="🆕 Latest" items={recent} showViewAll airInfo />
        <AnimeShelf title="🔥 Trending" items={trending} />
        <AnimeShelf title="⭐ Popular" items={popular} />

        <section className="shelf">
          <div className="shelfHead">
            <h2>📅 Airing Schedule</h2>
          </div>
          <ScheduleView schedule={schedule} />
        </section>
      </section>
    </main>
  );
}

function AnimeShelf({ title, items, showViewAll = false, airInfo = false }) {
  if (!items || items.length === 0) {
    return (
      <section className="shelf">
        <div className="shelfHead">
          <h2>{title}</h2>
          {showViewAll && <Link href="/anime/latest" className="viewAllLink">View All →</Link>}
        </div>
        <p className="empty">Loading...</p>
      </section>
    );
  }

  return (
    <section className="shelf">
      <div className="shelfHead">
        <h2>{title}</h2>
        {showViewAll && <Link href="/anime/latest" className="viewAllLink">View All →</Link>}
      </div>
      <div className="animeGrid">
        {items.slice(0, 12).map(anime => (
          <Link key={anime.id} href={`/anime/${anime.id}`} className="animeCard">
            <div className="animePoster">
              {isValidUrl(anime.image) ? (
                <img src={anime.image} alt={anime.title} loading="lazy" />
              ) : (
                <div className="noPoster">🎌</div>
              )}
              {anime.score && <span className="animeScore">★ {anime.score}</span>}
            </div>
            <div className="animeInfo">
              <h3>{anime.title}</h3>
              {airInfo ? (
                <>
                  <span className="animeMeta">
                    {[anime.format, anime.year].filter(Boolean).join(' • ')}
                  </span>
                  {(anime.episode || anime.airedAgo) && (
                    <span className="animeAirInfo">
                      {anime.episode ? `Ep ${anime.episode}` : ''}
                      {anime.episode && anime.airedAgo ? ' • ' : ''}
                      {anime.airedAgo || ''}
                    </span>
                  )}
                </>
              ) : (
                anime.year && <span>{anime.year}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}