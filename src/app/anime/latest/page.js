// src/app/anime/latest/page.jsx
import Header from '@/components/Header';
import LatestInfiniteGrid from '@/components/LatestInfiniteGrid';

export const revalidate = 3600;

const ANILIST_API = 'https://graphql.anilist.co';
const PER_PAGE = 24;

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('http');
}

function formatTimeAgo(unixSeconds) {
  if (!unixSeconds) return null;
  const diffMs = Date.now() - unixSeconds * 1000;
  if (diffMs < 0) return null;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

async function fetchFirstPage() {
  const query = `
    query ($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        pageInfo { hasNextPage }
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
            season
            countryOfOrigin
            isAdult
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { perPage: PER_PAGE } }),
      next: { revalidate: 3600 },
    });

    if (!response.ok) return { items: [], hasNextPage: false };

    const data = await response.json();
    const pageData = data?.data?.Page;
    const schedules = pageData?.airingSchedules || [];
    const hasNextPage = Boolean(pageData?.pageInfo?.hasNextPage);

    const seenMediaIds = new Set();
    const items = [];

    for (const entry of schedules) {
      const item = entry.media;
      if (!item || seenMediaIds.has(item.id)) continue;
      if (item.isAdult) continue;
      if (item.countryOfOrigin === 'CN') continue;
      const image = item.coverImage?.extraLarge || item.coverImage?.large;
      if (!isValidUrl(image)) continue;

      seenMediaIds.add(item.id);
      items.push({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || item.title?.native || 'Unknown',
        image,
        score: item.averageScore ? (item.averageScore / 10).toFixed(1) : null,
        year: item.seasonYear || null,
        season: item.season || null,
        format: item.format || '',
        episode: entry.episode || null,
        airedAgo: formatTimeAgo(entry.airingAt),
      });
    }

    return { items, hasNextPage };
  } catch (error) {
    return { items: [], hasNextPage: false };
  }
}

export default async function LatestAnimePage() {
  const { items, hasNextPage } = await fetchFirstPage();

  return (
    <main className="siteShell">
      <Header />
      <section className="listing">
        <p className="eyebrow">THE GREED INDEX</p>
        <h1>Latest <em>Episodes</em></h1>
        <LatestInfiniteGrid initialItems={items} initialHasNextPage={hasNextPage} />
      </section>
    </main>
  );
}