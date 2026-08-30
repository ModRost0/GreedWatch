// src/app/api/anime-more/route.js - Fixed, no invalid import
import { NextResponse } from 'next/server';

const ANILIST_API = 'https://graphql.anilist.co';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 20;
  
  try {
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: START_DATE_DESC, isAdult: false) {
            id
            title { romaji english native }
            coverImage { large extraLarge }
            averageScore
            episodes
            seasonYear
            format
            genres
          }
        }
      }
    `;
    
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { page, perPage } }),
    });
    
    if (!response.ok) return NextResponse.json([]);
    
    const data = await response.json();
    const media = data?.data?.Page?.media || [];
    
    const results = media
      .filter(item => !item.isAdult)
      .map(item => ({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || 'Unknown',
        image: item.coverImage?.extraLarge || item.coverImage?.large || null,
        score: item.averageScore ? (item.averageScore / 10).toFixed(1) : null,
        year: item.seasonYear || null,
        episodes: item.episodes || null,
      }));
    
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json([]);
  }
}