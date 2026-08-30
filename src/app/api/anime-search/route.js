// src/app/api/anime-search/route.js
import { NextResponse } from 'next/server';

const ANILIST_API = 'https://graphql.anilist.co';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const suggest = searchParams.get('suggest') === 'true';
  
  if (!query || query.trim().length < 1) {
    return NextResponse.json({ results: [], suggestions: [], total: 0 });
  }
  
  try {
    if (suggest) {
      // Return suggestions only
      const suggestions = await getSuggestions(query.trim());
      return NextResponse.json({ suggestions });
    }
    
    // Full search with results
    const results = await searchAniList(query.trim());
    return NextResponse.json({
      results: results.results || [],
      total: results.total || 0,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    return NextResponse.json({ results: [], suggestions: [], total: 0 });
  }
}

async function searchAniList(search) {
  const gqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 40) {
        pageInfo { total }
        media(search: $search, type: ANIME, isAdult: false) {
          id
          title { romaji english native }
          coverImage { large extraLarge }
          averageScore
          episodes
          seasonYear
          format
          genres
          status
        }
      }
    }
  `;
  
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: gqlQuery, variables: { search } }),
    cache: 'no-store',
  });
  
  if (!response.ok) return { results: [], total: 0 };
  
  const data = await response.json();
  const media = data?.data?.Page?.media || [];
  const total = data?.data?.Page?.pageInfo?.total || 0;
  
  const results = media
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
      status: item.status || '',
    }));
  
  return { results, total };
}

async function getSuggestions(search) {
  const gqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: ANIME, isAdult: false) {
          title { romaji english native }
        }
      }
    }
  `;
  
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: gqlQuery, variables: { search } }),
    cache: 'no-store',
  });
  
  if (!response.ok) return [];
  
  const data = await response.json();
  const media = data?.data?.Page?.media || [];
  
  const titles = new Set();
  const suggestions = [];
  
  for (const item of media) {
    const title = item.title?.english || item.title?.romaji || item.title?.native;
    if (title && !titles.has(title)) {
      titles.add(title);
      suggestions.push(title);
    }
  }
  
  return suggestions.slice(0, 8);
}