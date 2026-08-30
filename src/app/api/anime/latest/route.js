// src/app/api/anime/latest/route.js
import { NextResponse } from 'next/server';

const ANILIST_API = 'https://graphql.anilist.co';
const UPSTREAM_PER_PAGE = 50;
const TARGET_UNIQUE = 24;
const MAX_UPSTREAM_PAGES_PER_REQUEST = 8; // safety cap so one request can't loop forever

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

async function fetchUpstreamPage(upstreamPage) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
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

  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables: { page: upstreamPage, perPage: UPSTREAM_PER_PAGE } }),
    next: { revalidate: 3600 },
  });

  if (!response.ok) return { schedules: [], hasNextPage: false };

  const data = await response.json();
  const pageData = data?.data?.Page;
  return {
    schedules: pageData?.airingSchedules || [],
    hasNextPage: Boolean(pageData?.pageInfo?.hasNextPage),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // "cursor" = which raw AniList page to resume scanning from. This is NOT
  // the same as "how many batches the client has shown" — because
  // airingSchedules repeats the same anime across many entries (daily
  // shows air every day), one AniList page can dedupe down to very few
  // (sometimes zero) new titles. Mapping client-page -> AniList-page 1:1
  // meant some "pages" silently returned nothing new while still claiming
  // hasNextPage: true, so the client kept fetching invisibly forever.
  const cursor = Math.max(1, parseInt(searchParams.get('cursor') || '1', 10));
  // Anything the client has already rendered, so we don't just re-dedupe
  // against ourselves within this one request and hand back titles the
  // client already has on screen.
  const excludeParam = searchParams.get('exclude') || '';
  const excludeIds = new Set(excludeParam.split(',').filter(Boolean));

  let upstreamPage = cursor;
  let upstreamHasNextPage = true;
  const collected = [];
  const seenThisRequest = new Set();
  let pagesScanned = 0;

  while (
    collected.length < TARGET_UNIQUE &&
    upstreamHasNextPage &&
    pagesScanned < MAX_UPSTREAM_PAGES_PER_REQUEST
  ) {
    const { schedules, hasNextPage } = await fetchUpstreamPage(upstreamPage);
    upstreamHasNextPage = hasNextPage;
    pagesScanned += 1;

    for (const entry of schedules) {
      const item = entry.media;
      if (!item) continue;
      const idStr = String(item.id);
      if (seenThisRequest.has(idStr) || excludeIds.has(idStr)) continue;
      if (item.isAdult) continue;
      if (item.countryOfOrigin === 'CN') continue;
      const image = item.coverImage?.extraLarge || item.coverImage?.large;
      if (!isValidUrl(image)) continue;

      seenThisRequest.add(idStr);
      collected.push({
        id: idStr,
        title: item.title?.english || item.title?.romaji || item.title?.native || 'Unknown',
        image,
        score: item.averageScore ? (item.averageScore / 10).toFixed(1) : null,
        year: item.seasonYear || null,
        season: item.season || null,
        format: item.format || '',
        episode: entry.episode || null,
        airedAgo: formatTimeAgo(entry.airingAt),
      });

      if (collected.length >= TARGET_UNIQUE) break;
    }

    upstreamPage += 1;
  }

  return NextResponse.json({
    items: collected,
    // Resume from wherever we left off, and only claim more pages exist if
    // AniList itself still has more AND we didn't just hit the safety cap
    // with nothing left to try next time.
    nextCursor: upstreamPage,
    hasNextPage: upstreamHasNextPage,
  });
}