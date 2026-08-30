// src/lib/animeApi.js
const ANILIST_API = 'https://graphql.anilist.co';

async function anilistQuery(query, variables = {}) {
  try {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

function formatAnimeItem(media) {
  if (!media?.id) return null;
  if (media.isAdult) return null;
  
  const score = media.averageScore || media.meanScore || 0;
  
  return {
    id: String(media.id),
    title: media.title?.english || media.title?.romaji || media.title?.native || 'Unknown',
    titleRomaji: media.title?.romaji || null,
    titleEnglish: media.title?.english || null,
    titleNative: media.title?.native || null,
    image: media.coverImage?.extraLarge || media.coverImage?.large || null,
    banner: media.bannerImage || null,
    synopsis: media.description || '',
    episodes: media.episodes || null,
    score: Number((score / 10).toFixed(1)),
    year: media.seasonYear || media.startDate?.year || null,
    genres: media.genres || [],
    status: media.status || '',
    format: media.format || 'TV',
    popularity: media.popularity || 0,
  };
}

// Fetch multiple pages until enough valid results
async function fetchValidAnime(sortType, targetCount = 20, maxPages = 5) {
  const allResults = [];
  const seenIds = new Set();
  
  for (let page = 1; page <= maxPages; page++) {
    const query = `
      query ($page: Int, $sort: [MediaSort]) {
        Page(page: $page, perPage: 50) {
          media(type: ANIME, sort: $sort, isAdult: false) {
            id
            title { romaji english native }
            coverImage { large extraLarge }
            bannerImage
            averageScore
            meanScore
            popularity
            episodes
            seasonYear
            startDate { year }
            status
            format
            genres
            description
            countryOfOrigin
            isAdult
          }
          pageInfo { hasNextPage }
        }
      }
    `;
    
    const data = await anilistQuery(query, { page, sort: [sortType] });
    const media = data?.data?.Page?.media || [];
    
    for (const item of media) {
      if (seenIds.has(item.id)) continue;
      
      const formatted = formatAnimeItem(item);
      if (formatted) {
        seenIds.add(item.id);
        allResults.push(formatted);
        
        if (allResults.length >= targetCount) {
          return allResults;
        }
      }
    }
    
    const hasNextPage = data?.data?.Page?.pageInfo?.hasNextPage;
    if (hasNextPage === false) break;
  }
  
  return allResults;
}

// ============ COLLECTIONS ============
export async function getTrendingAnime() {
  return fetchValidAnime('TRENDING_DESC', 20, 5);
}

export async function getPopularAnime() {
  return fetchValidAnime('POPULARITY_DESC', 20, 5);
}

export async function getRecentAnime() {
  return fetchValidAnime('START_DATE_DESC', 20, 8);
}

// ============ SEARCH ============
export async function searchAnime(search) {
  if (!search || search.trim().length < 2) return [];
  
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 30) {
        media(search: $search, type: ANIME, isAdult: false) {
          id
          title { romaji english native }
          coverImage { large extraLarge }
          averageScore
          meanScore
          popularity
          episodes
          seasonYear
          startDate { year }
          status
          format
          genres
          description
          countryOfOrigin
          isAdult
        }
      }
    }
  `;
  
  const data = await anilistQuery(query, { search: search.trim() });
  const media = data?.data?.Page?.media || [];
  
  return media.map(formatAnimeItem).filter(Boolean);
}