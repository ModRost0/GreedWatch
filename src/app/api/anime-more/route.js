// src/app/api/anime-more/route.js
import { NextResponse } from 'next/server';
import { getMoreAnime } from '@/lib/animeApi';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 20;
  const mode = searchParams.get('mode') || 'recent'; // 'recent' | 'trending' | 'popular'

  try {
    const { items, hasNextPage } = await getMoreAnime({ page, perPage, mode });
    return NextResponse.json({ items, hasNextPage });
  } catch (error) {
    return NextResponse.json({ items: [], hasNextPage: false });
  }
}