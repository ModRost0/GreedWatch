// src/app/api/search/route.js
import { NextResponse } from 'next/server';

const TMDB_TOKEN = process.env.TMDB_TOKEN || process.env.NEXT_PUBLIC_TMDB_TOKEN;
const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  
  if (!query || !TMDB_TOKEN) {
    return NextResponse.json([]);
  }
  
  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`${TMDB_BASE}/search/movie?language=en-US&include_adult=false&query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' },
      }),
      fetch(`${TMDB_BASE}/search/tv?language=en-US&query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' },
      }),
    ]);
    
    const movieData = await movieRes.json();
    const tvData = await tvRes.json();
    
    const results = [
      ...(movieData.results || []).map(item => ({ ...item, media_type: 'movie' })),
      ...(tvData.results || []).map(item => ({ ...item, media_type: 'tv' })),
    ].filter(item => item.poster_path);
    
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json([]);
  }
}