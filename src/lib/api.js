// src/lib/api.js

const TMDB_TOKEN = process.env.TMDB_TOKEN || process.env.NEXT_PUBLIC_TMDB_TOKEN;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function tmdbFetch(path) {
  if (!TMDB_TOKEN) return null;
  
  try {
    const response = await fetch(`${TMDB_BASE_URL}${path}`, {
      headers: {
        'Authorization': `Bearer ${TMDB_TOKEN}`,
        'accept': 'application/json',
      },
      cache: 'no-store',
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

// ============ EMBED ============
export function getEmbed(type, id, options = {}) {
  if (!type || !id || id === 'undefined') return '';
  
  const decodedType = decodeURIComponent(type).toLowerCase();
  const decodedId = decodeURIComponent(id);
  const params = new URLSearchParams();
  
  if (decodedId.startsWith('tt')) {
    params.append('imdb', decodedId);
  } else {
    params.append('tmdb', decodedId);
  }
  
  if (options.season) params.append('season', options.season);
  if (options.episode) params.append('episode', options.episode);
  
  const endpoint = decodedType === 'movie' ? 'movie' : 'tv';
  return `https://primesrc.me/embed/${endpoint}?${params.toString()}`;
}

// ============ SEARCH ============
export async function getSearch(query) {
  if (!query || !TMDB_TOKEN) return [];
  
  const [movieData, tvData] = await Promise.all([
    tmdbFetch(`/search/movie?language=en-US&include_adult=false&query=${encodeURIComponent(query.trim())}`),
    tmdbFetch(`/search/tv?language=en-US&query=${encodeURIComponent(query.trim())}`),
  ]);
  
  const results = [
    ...(movieData?.results || []).map(item => ({ ...item, media_type: 'movie', displayTitle: item.title })),
    ...(tvData?.results || []).map(item => ({ ...item, media_type: 'tv', displayTitle: item.name })),
  ].filter(item => item.poster_path);
  
  return results;
}

// ============ POPULAR ============
export async function getPopularMovies() {
  const data = await tmdbFetch('/movie/popular?language=en-US&page=1');
  return (data?.results || []).filter(item => item.poster_path);
}

export async function getPopularTv() {
  const data = await tmdbFetch('/tv/popular?language=en-US&page=1');
  return (data?.results || []).filter(item => item.poster_path);
}

// ============ TRENDING ============
export async function getTrending() {
  const data = await tmdbFetch('/trending/all/day?language=en-US');
  return (data?.results || []).filter(item => item.poster_path);
}

// ============ OTHER ============
export async function getPopularMoviesPage(page = 1) {
  const data = await tmdbFetch(`/movie/popular?language=en-US&page=${page}`);
  if (!data) return { results: [], totalPages: 0 };
  return { results: data.results || [], totalPages: data.total_pages || 1 };
}

export async function getLatestMovies() {
  const data = await tmdbFetch('/movie/now_playing?language=en-US&page=1');
  return (data?.results || []).filter(item => item.poster_path);
}

export async function getLatestTv() {
  const data = await tmdbFetch('/tv/on_the_air?language=en-US&page=1');
  return (data?.results || []).filter(item => item.poster_path);
}

export async function getUpcoming() {
  const data = await tmdbFetch('/movie/upcoming?language=en-US&page=1');
  return (data?.results || []).filter(item => item.poster_path);
}

export async function getMediaDetails(id, type) {
  return tmdbFetch(`/${type}/${encodeURIComponent(id)}?language=en-US`);
}

export async function getSeasonEpisodes(tvId, seasonNumber) {
  const data = await tmdbFetch(`/tv/${tvId}/season/${seasonNumber}?language=en-US`);
  return data?.episodes || [];
}

export async function getMediaByTitle(title) {
  if (!TMDB_TOKEN || !title) return null;
  
  const query = encodeURIComponent(title.trim());
  const [movieData, tvData] = await Promise.all([
    tmdbFetch(`/search/movie?language=en-US&include_adult=false&query=${query}`),
    tmdbFetch(`/search/tv?language=en-US&query=${query}`),
  ]);
  
  const movie = movieData?.results?.[0];
  const tv = tvData?.results?.[0];
  
  if (!movie && !tv) return null;
  
  if (movie && (!tv || (movie.popularity || 0) >= (tv.popularity || 0))) {
    return { ...movie, mediaType: 'movie', displayTitle: movie.title };
  }
  return { ...tv, mediaType: 'tv', displayTitle: tv.name };
}

export async function fetchRecommended(id, type = 'movie') {
  const endpoint = type === 'tv' ? 'tv' : 'movie';
  const data = await tmdbFetch(`/${endpoint}/${id}/recommendations?language=en-US&page=1`);
  return (data?.results || []).filter(item => item.poster_path);
}

export function getPopular() { return getPopularTv(); }
export function getLatest() { return getLatestTv(); }