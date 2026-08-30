// src/app/api/anime-stream/route.js
import { NextResponse } from 'next/server';

const MIRURO_API = 'https://mirurotvapi.vercel.app/api';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || '';
  
  const url = `${MIRURO_API}${endpoint}`;
  
  console.log('Streaming fetch:', url);
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    
    if (!response.ok) {
      return NextResponse.json({ success: false, results: null });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, results: null });
  }
}