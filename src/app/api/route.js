// src/app/api/home/route.js
import { NextResponse } from 'next/server';

const TMDB_TOKEN = process.env.TMDB_TOKEN || process.env.NEXT_PUBLIC_TMDB_TOKEN;
const TMDB_BASE = 'https://api.themoviedb.org/3';

async function fetchTMDB(path) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${TMDB_BASE}${path}`, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return [];
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  
  let results = [];
  
  if (type === 'trending') {
    results = await fetchTMDB('/trending/all/day?language=en-US');
    results = results.filter(r => r.poster_path).slice(0, 10);
  } else if (type === 'popular_movies') {
    results = await fetchTMDB('/movie/popular?language=en-US&page=1');
    results = results.filter(r => r.poster_path).slice(0, 8);
  } else if (type === 'popular_tv') {
    results = await fetchTMDB('/tv/popular?language=en-US&page=1');
    results = results.filter(r => r.poster_path).slice(0, 8);
  }
  
  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}