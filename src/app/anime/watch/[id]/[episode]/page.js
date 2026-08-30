// src/app/anime/watch/[id]/[episode]/page.jsx - Fixed episode display

'use client';

import { useState, useEffect, Suspense, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import Header from '@/components/Header';
import CommentsSection from '@/components/CommentsSection';
import AddToPlaylist from '@/components/AddToPlaylist';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

const ANILIST_API = 'https://graphql.anilist.co';

// ============================================
// SERVER CONFIGURATIONS
// ============================================
const SERVERS = {
  megavid: {
    id: 'megavid',
    name: 'Server 1',
    icon: '🚀',
    requiresSdk: false,
    buildUrl: (animeId, episode, audio) => {
      const audioParam = audio === 'dub' ? 'dub' : 'sub';
      return `https://megavid.buzz/ani/${animeId}/${episode}/${audioParam}?color=%234caf50&autoplay=true`;
    },
    supportsAudio: ['sub', 'dub'],
  },
  anixo: {
    id: 'anixo',
    name: 'Server 2',
    icon: '🌐',
    requiresSdk: true,
    sdkUrl: 'https://anixo.buzz/embed-sdk.js',
    buildUrl: (animeId, episode, audio) => {
      return `https://anixo.buzz/embed/ani/${animeId}/${episode}/${audio}?color=%234caf50&autoplay=true&embed=true`;
    },
    supportsAudio: ['sub', 'dub'],
  },
};

// ============================================
// RETRY UTILITY
// ============================================
async function fetchWithRetry(url, options, maxRetries = 3, initialDelay = 1000) {
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      if (response.status === 429) {
        const delay = initialDelay * Math.pow(2, attempt) * 2;
        console.log(`Rate limited (attempt ${attempt + 1}/${maxRetries}), waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (response.status === 404) {
        return response;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } catch (error) {
      lastError = error;
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Network error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  if (lastError) {
    throw lastError;
  }
  throw new Error(`Failed to fetch after ${maxRetries} attempts`);
}

async function fetchAniList(query, variables, retryCount = 3) {
  try {
    const response = await fetchWithRetry(ANILIST_API, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json' 
      },
      body: JSON.stringify({ query, variables }),
    }, retryCount);
    
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('AniList fetch error:', error);
    return null;
  }
}

// ============================================
// HELPER: Get all relations for an anime
// ============================================
async function getAnimeRelations(mediaId, retryCount = 2) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        episodes
        seasonYear
        coverImage { large }
        format
        averageScore
        status
        relations {
          edges {
            relationType
            node {
              id
              format
              type
              title { romaji english }
            }
          }
        }
      }
    }
  `;
  
  const data = await fetchAniList(query, { id: mediaId }, retryCount);
  return data?.data?.Media || null;
}

// ============================================
// HELPER: Get full season chain with retry
// ============================================
async function getFullSeasonChain(mediaId, retryCount = 2) {
  const visited = new Set();
  const allSeasons = [];
  
  async function findEarliestSeason(id) {
    if (visited.has(id)) return id;
    visited.add(id);
    
    const media = await getAnimeRelations(id, retryCount);
    if (!media) return id;
    
    const prequel = media.relations?.edges?.find(e => 
      e.relationType === 'PREQUEL' && 
      (e.node.format === 'TV' || e.node.format === 'TV_SHORT')
    );
    
    if (prequel && !visited.has(prequel.node.id)) {
      return findEarliestSeason(prequel.node.id);
    }
    
    return id;
  }
  
  async function collectSeasonsForward(id) {
    if (visited.has(id)) return;
    visited.add(id);
    
    const media = await getAnimeRelations(id, retryCount);
    if (!media) return;
    
    allSeasons.push({
      id: media.id,
      title: media.title?.english || media.title?.romaji || media.title?.native || 'Unknown',
      episodes: media.episodes,
      seasonYear: media.seasonYear,
      coverImage: media.coverImage?.large || null,
      format: media.format,
      averageScore: media.averageScore,
      status: media.status,
    });
    
    const sequels = media.relations?.edges
      ?.filter(e => e.relationType === 'SEQUEL' && (e.node.format === 'TV' || e.node.format === 'TV_SHORT'))
      ?.map(e => e.node) || [];
    
    for (const sequel of sequels) {
      if (!visited.has(sequel.id)) {
        await collectSeasonsForward(sequel.id);
      }
    }
  }
  
  try {
    const earliestId = await findEarliestSeason(mediaId);
    visited.clear();
    await collectSeasonsForward(earliestId);
  } catch (error) {
    console.error('Error fetching season chain:', error);
    const current = await getAnimeRelations(mediaId, retryCount);
    if (current) {
      allSeasons.push({
        id: current.id,
        title: current.title?.english || current.title?.romaji || current.title?.native || 'Unknown',
        episodes: current.episodes,
        seasonYear: current.seasonYear,
        coverImage: current.coverImage?.large || null,
        format: current.format,
        averageScore: current.averageScore,
        status: current.status,
      });
    }
  }
  
  return allSeasons;
}

// ============================================
// HELPER: Get sequel info
// ============================================
async function getSequelInfo(mediaId, retryCount = 2) {
  const media = await getAnimeRelations(mediaId, retryCount);
  if (!media) return null;
  
  const sequel = media.relations?.edges?.find(e => 
    e.relationType === 'SEQUEL' && 
    (e.node.format === 'TV' || e.node.format === 'MOVIE' || e.node.format === 'OVA')
  );
  
  if (sequel) {
    const sequelData = await getAnimeRelations(sequel.node.id, retryCount);
    return {
      id: sequel.node.id,
      title: sequelData?.title?.english || sequelData?.title?.romaji || sequelData?.title?.native || 'Unknown',
      format: sequel.node.format,
      image: sequelData?.coverImage?.large || null,
      score: sequelData?.averageScore ? (sequelData.averageScore / 10).toFixed(1) : null,
      episodes: sequelData?.episodes,
      seasonYear: sequelData?.seasonYear,
      relationType: sequel.relationType,
    };
  }
  
  return null;
}

// ============================================
// COMPONENT: AnimeRating
// ============================================
function AnimeRating({ mediaId, initialScore }) {
  const auth = useAuth();
  const user = auth?.user || null;
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [averageRating, setAverageRating] = useState(Number(initialScore) || 0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadRatings();
    if (user) loadUserRating();
  }, [mediaId, user]);
  
  async function loadRatings() {
    try {
      setIsLoading(true);
      const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('media_id', String(mediaId));
      
      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(avg);
        setTotalRatings(data.length);
      }
    } catch (error) {
      console.error('Error loading ratings:', error);
    } finally {
      setIsLoading(false);
    }
  }
  
  async function loadUserRating() {
    try {
      const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('media_id', String(mediaId))
        .maybeSingle();
      
      if (data) setUserRating(data.rating);
    } catch (error) {
      console.error('Error loading user rating:', error);
    }
  }
  
  async function handleRate(value) {
    if (!user) {
      alert('Please sign in to rate');
      return;
    }
    
    setUserRating(value);
    
    try {
      await supabase.from('ratings').upsert({
        user_id: user.id,
        media_id: String(mediaId),
        media_type: 'anime',
        rating: value,
      });
      await loadRatings();
    } catch (error) {
      console.error('Error saving rating:', error);
      alert('Failed to save rating. Please try again.');
    }
  }
  
  return (
    <div className={styles.ratingContainer}>
      <div className={styles.starsDisplay}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            className={`${styles.starButton} ${star <= (hoverRating || userRating) ? styles.active : ''}`}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => handleRate(star)}
            disabled={isLoading}
          >
            ★
          </button>
        ))}
      </div>
      <span className={styles.ratingInfo}>
        {isLoading ? (
          <span>Loading...</span>
        ) : totalRatings > 0 ? (
          <span><strong>{averageRating.toFixed(1)}</strong> ({totalRatings})</span>
        ) : initialScore ? (
          <span className={styles.tmdbRating}>AniList: {Number(initialScore).toFixed(1)}</span>
        ) : (
          <span className={styles.noRatings}>Rate this</span>
        )}
      </span>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
function AnimeWatchContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const user = auth?.user || null;
  const animeId = params?.id;
  const episodeNumber = Number(params?.episode) || 1;
  const seasonParam = searchParams?.get('season');
  
  const [animeInfo, setAnimeInfo] = useState(null);
  const [airedEpisodes, setAiredEpisodes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [sequelInfo, setSequelInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasTrackedWatch, setHasTrackedWatch] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [currentEpisode, setCurrentEpisode] = useState(episodeNumber);
  const [currentAudio, setCurrentAudio] = useState('sub');
  const [currentServer, setCurrentServer] = useState('megavid');
  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerRetryCount, setPlayerRetryCount] = useState(0);
  
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(1);
  const [activeSeasonEpisodes, setActiveSeasonEpisodes] = useState([]);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  
  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  const getAvailableServers = useCallback(() => {
    return Object.values(SERVERS).filter(server => 
      server.supportsAudio.includes(currentAudio)
    );
  }, [currentAudio]);

  const getEmbedUrl = useCallback(() => {
    const server = SERVERS[currentServer];
    if (!server) return '';
    return server.buildUrl(animeId, currentEpisode, currentAudio);
  }, [animeId, currentEpisode, currentAudio, currentServer]);

  const handleServerChange = (serverId) => {
    if (serverId === currentServer) return;
    setCurrentServer(serverId);
    setPlayerLoading(true);
    setPlayerError(false);
    setPlayerReady(false);
    setPlayerRetryCount(0);
    setIframeKey(prev => prev + 1);
  };

  const initAniXoPlayer = useCallback(() => {
    if (!containerRef.current || !window.AniXoEmbed || currentServer !== 'anixo') return;
    
    try {
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }

      const player = new window.AniXoEmbed({
        container: containerRef.current,
        animeId: animeId,
        episode: currentEpisode,
        audio: currentAudio,
        color: '#4caf50',
        autoplay: true,
        embed: true,
        onReady: () => {
          setPlayerReady(true);
          setPlayerLoading(false);
          setPlayerError(false);
          setPlayerRetryCount(0);
        },
        onEnded: () => {
          if (currentEpisode < airedEpisodes.length) {
            handleEpisodeChange(currentEpisode + 1);
          }
        },
        onPlay: () => {
          trackWatch();
        },
        onError: (error) => {
          console.error('AniXo player error:', error);
          setPlayerError(true);
          setPlayerLoading(false);
          if (playerRetryCount < 2 && currentServer === 'anixo') {
            setPlayerRetryCount(prev => prev + 1);
            setTimeout(() => {
              setCurrentServer('megavid');
            }, 1000);
          }
        }
      });
      
      window.__anixoPlayer = player;
      
    } catch (error) {
      console.error('Failed to init AniXo player:', error);
      setPlayerError(true);
      setPlayerLoading(false);
      if (playerRetryCount < 2 && currentServer === 'anixo') {
        setPlayerRetryCount(prev => prev + 1);
        setTimeout(() => {
          setCurrentServer('megavid');
        }, 1000);
      }
    }
  }, [animeId, currentEpisode, currentAudio, currentServer, airedEpisodes, playerRetryCount]);

  const loadAnimeData = useCallback(async () => {
    if (!animeId) return;
    
    setIsLoading(true);
    setLoadError(null);
    
    try {
      // Fetch main anime data
      const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title { romaji english native }
            coverImage { large extraLarge }
            bannerImage
            averageScore
            episodes
            duration
            status
            season
            seasonYear
            format
            genres
            description
            countryOfOrigin
            isAdult
            studios { nodes { name } }
            nextAiringEpisode { episode airingAt timeUntilAiring }
            airingSchedule { nodes { episode airingAt } }
          }
        }
      `;
      
      const data = await fetchAniList(query, { id: Number(animeId) }, 3);
      const media = data?.data?.Media;
      
      if (!media) {
        throw new Error('Failed to load anime data');
      }
      
      setAnimeInfo({
        id: String(media.id),
        title: media.title?.english || media.title?.romaji || 'Unknown',
        image: media.coverImage?.extraLarge || media.coverImage?.large || null,
        banner: media.bannerImage || null,
        score: media.averageScore ? (media.averageScore / 10).toFixed(1) : null,
        episodes: media.episodes || null,
        status: media.status || '',
        year: media.seasonYear || null,
        format: media.format || '',
        genres: media.genres || [],
        synopsis: media.description || '',
        isAdult: media.isAdult || false,
        nextAiring: media.nextAiringEpisode,
        studios: media.studios?.nodes || [],
      });
      
      // Determine available episodes
      const now = Math.floor(Date.now() / 1000);
      let episodeList = [];
      
      if (media.status === 'FINISHED' && media.episodes) {
        episodeList = Array.from({ length: Math.min(media.episodes, 1000) }, (_, i) => i + 1);
      } else {
        const airedNodes = (media.airingSchedule?.nodes || [])
          .filter(node => node.airingAt && node.airingAt <= now);
        const airedNumbers = airedNodes.map(n => n.episode);
        
        if (airedNumbers.length > 0) {
          const maxAired = Math.max(...airedNumbers);
          episodeList = Array.from({ length: Math.min(maxAired, 1000) }, (_, i) => i + 1);
        } else if (media.nextAiringEpisode?.episode > 1) {
          const totalAired = Math.min(media.nextAiringEpisode.episode - 1, 1000);
          episodeList = Array.from({ length: totalAired }, (_, i) => i + 1);
        } else {
          episodeList = [1];
        }
      }
      
      setAiredEpisodes(episodeList);
      
      // Get season chain
      const seasonChain = await getFullSeasonChain(Number(animeId), 2);
      
      // Build season groups
      const seasonGroups = [];
      if (seasonChain.length > 0) {
        let cumulativeEpisodes = 0;
        
        seasonChain.forEach((season, index) => {
          let seasonEpisodes;
          
          if (season.id === Number(animeId)) {
            seasonEpisodes = episodeList;
          } else {
            // Estimate episodes for other seasons
            const epCount = season.episodes || 12;
            const startEp = cumulativeEpisodes + 1;
            const endEp = startEp + epCount - 1;
            seasonEpisodes = Array.from({ length: epCount }, (_, i) => startEp + i);
          }
          
          seasonGroups.push({
            seasonNumber: index + 1,
            episodes: seasonEpisodes,
            title: `Season ${index + 1}`,
            startEpisode: seasonEpisodes[0] || 1,
            endEpisode: seasonEpisodes[seasonEpisodes.length - 1] || 1,
            aniListId: season.id,
            seasonTitle: season.title,
            coverImage: season.coverImage,
          });
          
          cumulativeEpisodes += seasonEpisodes.length;
        });
      } else {
        // Fallback: single season
        seasonGroups.push({
          seasonNumber: 1,
          episodes: episodeList,
          title: 'Season 1',
          startEpisode: episodeList[0] || 1,
          endEpisode: episodeList[episodeList.length - 1] || 1,
          aniListId: Number(animeId),
          seasonTitle: animeInfo?.title || 'Unknown',
        });
      }
      
      setSeasons(seasonGroups);
      
      // Determine active season
      let targetSeason = 1;
      if (seasonParam) {
        targetSeason = Number(seasonParam);
      } else {
        const currentIndex = seasonChain.findIndex(s => s.id === Number(animeId));
        if (currentIndex >= 0) {
          targetSeason = currentIndex + 1;
        }
      }
      
      const activeSeasonGroup = seasonGroups.find(s => s.seasonNumber === targetSeason);
      if (activeSeasonGroup) {
        setActiveSeason(targetSeason);
        setActiveSeasonEpisodes(activeSeasonGroup.episodes);
      } else if (seasonGroups.length > 0) {
        setActiveSeason(1);
        setActiveSeasonEpisodes(seasonGroups[0].episodes);
      }
      
      // Get sequel and recommendations
      const [sequel, recs] = await Promise.all([
        getSequelInfo(Number(animeId), 2),
        loadRecommendations(media.genres || [], media.id),
      ]);
      
      setSequelInfo(sequel);
      setRecommendations(recs);
      
    } catch (error) {
      console.error('Failed to load anime:', error);
      setLoadError(error.message || 'Failed to load anime data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [animeId, seasonParam]);

  async function loadRecommendations(genres, currentAnimeId) {
    try {
      const genreNames = genres?.slice(0, 2) || [];
      
      const query = `
        query ($genres: [String], $excludeId: Int) {
          Page(page: 1, perPage: 10) {
            media(type: ANIME, genre_in: $genres, id_not: $excludeId, isAdult: false, sort: POPULARITY_DESC) {
              id
              title { romaji english }
              coverImage { large }
              averageScore
              format
            }
          }
        }
      `;
      
      const data = await fetchAniList(query, { genres: genreNames, excludeId: Number(currentAnimeId) }, 2);
      return (data?.data?.Page?.media || []).map(item => ({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || 'Unknown',
        image: item.coverImage?.large || null,
        score: item.averageScore ? (item.averageScore / 10).toFixed(1) : null,
      }));
    } catch (error) {
      console.error('Error loading recommendations:', error);
      return [];
    }
  }

  // Filtered episodes based on search
  const filteredSeasonEpisodes = useMemo(() => {
    if (!episodeSearch.trim()) return activeSeasonEpisodes;
    const searchTerm = episodeSearch.trim();
    return activeSeasonEpisodes.filter(ep => String(ep).includes(searchTerm));
  }, [activeSeasonEpisodes, episodeSearch]);

  function handleSeasonChange(seasonNumber) {
    const seasonGroup = seasons.find(s => s.seasonNumber === seasonNumber);
    if (!seasonGroup) return;
    
    // If clicking on a different anime, navigate to it
    if (seasonGroup.aniListId !== Number(animeId)) {
      window.location.href = `/anime/${seasonGroup.aniListId}`;
      return;
    }
    
    setActiveSeason(seasonNumber);
    setEpisodeSearch('');
    setIsLoadingEpisodes(true);
    setActiveSeasonEpisodes(seasonGroup.episodes);
    
    if (seasonGroup.episodes.length > 0) {
      const firstEpisode = seasonGroup.episodes[0];
      setCurrentEpisode(firstEpisode);
      setPlayerLoading(true);
      setPlayerError(false);
      setPlayerReady(false);
      setPlayerRetryCount(0);
      setIframeKey(prev => prev + 1);
      window.history.pushState({}, '', `/anime/watch/${animeId}/${firstEpisode}?season=${seasonNumber}`);
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    setTimeout(() => setIsLoadingEpisodes(false), 300);
  }

  async function checkFavorite() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('media_id', `anime-${animeId}`)
        .maybeSingle();
      setIsFavorite(!!data);
    } catch (error) {
      console.error('Error checking favorite:', error);
    }
  }

  async function toggleFavorite() {
    if (!user) {
      alert('Please sign in to add favorites');
      return;
    }
    try {
      if (isFavorite) {
        await supabase.from('favorites').delete()
          .eq('user_id', user.id)
          .eq('media_id', `anime-${animeId}`);
        setIsFavorite(false);
      } else {
        await supabase.from('favorites').insert({
          user_id: user.id,
          media_id: `anime-${animeId}`,
          media_type: 'anime',
          title: animeInfo?.title,
          poster: animeInfo?.image,
        });
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Failed to update favorite. Please try again.');
    }
  }

  async function trackWatch() {
    if (!animeInfo?.title || hasTrackedWatch) return;
    setHasTrackedWatch(true);
    
    const watchItem = {
      media_id: `anime-${animeId}`,
      media_type: 'anime',
      title: animeInfo.title,
      poster: animeInfo.image,
      episode: currentEpisode,
      season: activeSeason,
      watched_at: new Date().toISOString(),
    };
    
    try {
      if (user) {
        await supabase.from('watch_history').upsert({
          user_id: user.id,
          ...watchItem,
        }, { onConflict: 'user_id,media_id,media_type,episode' });
      } else {
        let guestHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
        guestHistory = guestHistory.filter(item => 
          !(item.media_id === watchItem.media_id && item.episode === watchItem.episode)
        );
        guestHistory.unshift(watchItem);
        guestHistory = guestHistory.slice(0, 50);
        localStorage.setItem('watchHistory', JSON.stringify(guestHistory));
      }
    } catch (error) {
      console.error('Error tracking watch:', error);
    }
  }

  function handleEpisodeChange(newEpisode) {
    if (newEpisode < 1 || newEpisode > airedEpisodes.length) return;
    
    setCurrentEpisode(newEpisode);
    setHasTrackedWatch(false);
    setPlayerLoading(true);
    setPlayerError(false);
    setPlayerReady(false);
    setPlayerRetryCount(0);
    setIframeKey(prev => prev + 1);
    
    // Update active season based on episode
    const seasonGroup = seasons.find(s => s.episodes.includes(newEpisode));
    if (seasonGroup && seasonGroup.seasonNumber !== activeSeason) {
      setActiveSeason(seasonGroup.seasonNumber);
      setActiveSeasonEpisodes(seasonGroup.episodes);
    }
    
    window.history.pushState({}, '', `/anime/watch/${animeId}/${newEpisode}?season=${seasonGroup?.seasonNumber || activeSeason}`);
    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleAudioChange(audio) {
    setCurrentAudio(audio);
    setPlayerLoading(true);
    setPlayerError(false);
    setPlayerReady(false);
    setPlayerRetryCount(0);
    setIframeKey(prev => prev + 1);
    const available = getAvailableServers();
    if (available.length > 0) {
      setCurrentServer(available[0].id);
    }
  }

  useEffect(() => {
    if (animeId) {
      loadAnimeData();
      checkFavorite();
    }
  }, [animeId, loadAnimeData]);

  useEffect(() => {
    if (!playerLoading && !playerError && !hasTrackedWatch) {
      const timer = setTimeout(() => trackWatch(), 5000);
      return () => clearTimeout(timer);
    }
  }, [playerLoading, playerError, currentEpisode, hasTrackedWatch]);

  const handleSdkLoad = () => {
    setSdkLoaded(true);
    if (currentServer === 'anixo') {
      setTimeout(initAniXoPlayer, 100);
    }
  };

  useEffect(() => {
    if (currentServer === 'anixo') {
      if (sdkLoaded && window.AniXoEmbed) {
        initAniXoPlayer();
      }
    }
  }, [currentServer, sdkLoaded, initAniXoPlayer]);

  const currentServerConfig = SERVERS[currentServer];
  const needsSdk = currentServerConfig?.requiresSdk || false;

  const getTimeUntilNext = () => {
    if (!animeInfo?.nextAiring?.airingAt) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = animeInfo.nextAiring.airingAt - now;
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className={styles.watchPage}>
        <Header />
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading anime...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.watchPage}>
        <Header />
        <div className={styles.errorContainer}>
          <span className={styles.errorIcon}>⚠️</span>
          <h2>Failed to Load</h2>
          <p className={styles.errorMessage}>{loadError}</p>
          <button 
            className={styles.retryButtonLarge}
            onClick={() => loadAnimeData()}
          >
            🔄 Retry
          </button>
          <Link href={`/anime/${animeId}`} className={styles.backButtonLarge}>
            ← Back to Anime Page
          </Link>
        </div>
      </div>
    );
  }

  const timeUntilNext = getTimeUntilNext();

  return (
    <div className={styles.watchPage}>
      <Header />
      
      {needsSdk && (
        <Script
          src={SERVERS.anixo.sdkUrl}
          strategy="afterInteractive"
          onLoad={handleSdkLoad}
          onError={() => {
            setSdkLoaded(true);
            setCurrentServer('megavid');
          }}
        />
      )}
      
      <div className={styles.watchContent}>
        <div className={styles.playerSection}>
          <Link href={`/anime/${animeId}`} className={styles.backButton}>
            ← Back to {animeInfo?.title || 'Anime'}
          </Link>
          
          <div className={styles.videoPlayer} ref={playerRef}>
            {playerLoading && !playerError && (
              <div className={styles.loadingPlayer}>
                <div className={styles.spinner}></div>
                <p>Loading video from {currentServerConfig?.name || 'server'}...</p>
              </div>
            )}
            
            {playerError && (
              <div className={styles.playerError}>
                <span>⚠️</span>
                <p>Failed to load from {currentServerConfig?.name || 'server'}</p>
                <button 
                  className={styles.retryButton}
                  onClick={() => {
                    setPlayerError(false);
                    setPlayerLoading(true);
                    setPlayerReady(false);
                    setPlayerRetryCount(prev => prev + 1);
                    if (currentServer === 'anixo' && playerRetryCount < 2) {
                      setCurrentServer('megavid');
                    } else {
                      setIframeKey(prev => prev + 1);
                    }
                  }}
                >
                  Retry
                </button>
                <div className={styles.serverSuggestions}>
                  <span>Try: </span>
                  {getAvailableServers()
                    .filter(s => s.id !== currentServer)
                    .map(s => (
                      <button 
                        key={s.id}
                        className={styles.suggestionButton}
                        onClick={() => handleServerChange(s.id)}
                      >
                        {s.icon} {s.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
            
            {currentServer === 'anixo' ? (
              <div 
                ref={containerRef} 
                className={styles.anixoContainer}
                style={{ 
                  width: '100%', 
                  height: '100%',
                  display: playerLoading || playerError ? 'none' : 'block'
                }}
              />
            ) : (
              <iframe
                ref={iframeRef}
                key={iframeKey}
                src={getEmbedUrl()}
                className={styles.playerIframe}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                scrolling="no"
                frameBorder="0"
                onLoad={() => {
                  setPlayerLoading(false);
                  setPlayerError(false);
                  setPlayerRetryCount(0);
                }}
                onError={() => {
                  setPlayerLoading(false);
                  setPlayerError(true);
                }}
                style={{
                  display: playerLoading || playerError ? 'none' : 'block',
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            )}
          </div>
          
          <div className={styles.sourceSelector}>
            <span>Audio:</span>
            <button
              className={`${styles.sourceButton} ${currentAudio === 'sub' ? styles.activeSource : ''}`}
              onClick={() => handleAudioChange('sub')}
            >
              Subbed
            </button>
            <button
              className={`${styles.sourceButton} ${currentAudio === 'dub' ? styles.activeSource : ''}`}
              onClick={() => handleAudioChange('dub')}
            >
              Dubbed
            </button>
          </div>
          
          <div className={styles.serverSelector}>
            <span className={styles.serverLabel}>Server:</span>
            <div className={styles.serverButtons}>
              {getAvailableServers().map(server => (
                <button
                  key={server.id}
                  className={`${styles.serverButton} ${currentServer === server.id ? styles.activeServer : ''}`}
                  onClick={() => handleServerChange(server.id)}
                >
                  <span className={styles.serverIcon}>{server.icon}</span>
                  {server.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* SEASON SELECTOR */}
          {seasons.length > 1 && (
            <div className={styles.seasonSelector}>
              <span className={styles.seasonLabel}>Season:</span>
              <div className={styles.seasonButtons}>
                {seasons.map(season => (
                  <button
                    key={season.seasonNumber}
                    className={`${styles.seasonButton} ${activeSeason === season.seasonNumber ? styles.activeSeason : ''}`}
                    onClick={() => handleSeasonChange(season.seasonNumber)}
                    title={season.seasonTitle}
                  >
                    <span className={styles.seasonButtonTitle}>
                      S{season.seasonNumber}
                    </span>
                    <span className={styles.seasonRange}>
                      {season.aniListId === Number(animeId) 
                        ? `${season.episodes.length} eps`
                        : season.seasonTitle?.slice(0, 15) || `S${season.seasonNumber}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* EPISODE LIST - THE FIXED PART */}
          <div className={styles.episodesSection}>
            <div className={styles.episodesHeader}>
              <h3 className={styles.episodesTitle}>
                {seasons.length > 1 ? `Season ${activeSeason} Episodes` : 'Episodes'} 
                <span className={styles.episodeCountBadge}>
                  {activeSeasonEpisodes.length}
                </span>
              </h3>
              {timeUntilNext && animeInfo?.status !== 'FINISHED' && (
                <span className={styles.nextEpisodeBadge}>
                  Next: Ep {animeInfo.nextAiring?.episode || airedEpisodes.length + 1} in {timeUntilNext}
                </span>
              )}
            </div>
            
            {/* Episode Search */}
            {activeSeasonEpisodes.length > 30 && (
              <div className={styles.episodeSearchContainer}>
                <input
                  type="text"
                  placeholder="🔍 Search episode..."
                  value={episodeSearch}
                  onChange={(e) => setEpisodeSearch(e.target.value)}
                  className={styles.episodeSearch}
                />
                {episodeSearch && (
                  <button 
                    className={styles.clearSearch}
                    onClick={() => setEpisodeSearch('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            
            {isLoadingEpisodes ? (
              <div className={styles.loadingEpisodes}>Loading episodes...</div>
            ) : (
              <>
                <div className={styles.animeEpisodesGrid}>
                  {filteredSeasonEpisodes.length > 0 ? (
                    filteredSeasonEpisodes.map(ep => {
                      const isCurrent = currentEpisode === ep;
                      const isWatched = false; // Could add watch tracking here
                      
                      return (
                        <button
                          key={ep}
                          className={`${styles.animeEpisodeCard} ${isCurrent ? styles.activeEpisode : ''} ${isWatched ? styles.watchedEpisode : ''}`}
                          onClick={() => handleEpisodeChange(ep)}
                          title={`Episode ${ep}`}
                        >
                          <span className={styles.episodeNumber}>EP {ep}</span>
                          {isCurrent && <span className={styles.playingIndicator}>▶</span>}
                        </button>
                      );
                    })
                  ) : (
                    <p className={styles.noEpisodes}>
                      No episodes found matching &quot;{episodeSearch}&quot;
                    </p>
                  )}
                </div>
                
                {/* Episode count info */}
                {filteredSeasonEpisodes.length > 0 && (
                  <div className={styles.episodeFooter}>
                    <span className={styles.episodeFooterText}>
                      Showing {filteredSeasonEpisodes.length} of {activeSeasonEpisodes.length} episodes
                      {episodeSearch && ` (filtered)`}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* EPISODE NAVIGATION */}
          <div className={styles.episodeNavigation}>
            <button 
              className={styles.navButton} 
              onClick={() => handleEpisodeChange(currentEpisode - 1)} 
              disabled={currentEpisode <= 1}
            >
              ← Previous
            </button>
            <span className={styles.navInfo}>
              {seasons.length > 1 ? `S${activeSeason} EP ${currentEpisode}` : `Episode ${currentEpisode}`}
              <span className={styles.navTotal}> / {airedEpisodes.length}</span>
            </span>
            <button 
              className={styles.navButton} 
              onClick={() => handleEpisodeChange(currentEpisode + 1)} 
              disabled={currentEpisode >= airedEpisodes.length}
            >
              Next →
            </button>
          </div>
          
          {/* MEDIA INFO */}
          <div className={styles.mediaInfo}>
            <div className={styles.titleRow}>
              <h1>{animeInfo?.title || 'Unknown'}</h1>
              {animeInfo?.year && <span className={styles.year}>{animeInfo.year}</span>}
              {animeInfo?.episodes && <span className={styles.episodeCount}>{animeInfo.episodes} eps</span>}
              {seasons.length > 1 && <span className={styles.seasonCount}>{seasons.length} Seasons</span>}
              {animeInfo?.status && (
                <span className={`${styles.statusBadge} ${styles[animeInfo.status.toLowerCase()]}`}>
                  {animeInfo.status}
                </span>
              )}
              {animeInfo?.format && <span className={styles.formatBadge}>{animeInfo.format}</span>}
              {animeInfo?.duration && <span className={styles.durationBadge}>{animeInfo.duration} min</span>}
              <button 
                className={`${styles.favoriteButton} ${isFavorite ? styles.isFavorite : ''}`}
                onClick={toggleFavorite}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                {isFavorite ? '❤️' : '🤍'}
              </button>
            </div>
            
            <div className={styles.mediaMeta}>
              <AnimeRating mediaId={`anime-${animeId}`} initialScore={animeInfo?.score} />
              {Array.isArray(animeInfo?.genres) && animeInfo.genres.length > 0 && (
                <span className={styles.genres}>{animeInfo.genres.slice(0, 3).join(' | ')}</span>
              )}
            </div>
            
            <p className={`${styles.synopsis} ${!showFullSynopsis ? styles.synopsisClamped : ''}`}>
              {animeInfo?.synopsis || 'No synopsis available.'}
            </p>
            {animeInfo?.synopsis && animeInfo.synopsis.length > 150 && (
              <button className={styles.moreButton} onClick={() => setShowFullSynopsis(!showFullSynopsis)}>
                {showFullSynopsis ? 'Show less' : 'Show more'}
              </button>
            )}
            
            <AddToPlaylist 
              mediaId={`anime-${animeId}`}
              mediaType="anime"
              title={animeInfo?.title}
              poster={animeInfo?.image}
            />
          </div>
          
          <CommentsSection 
            mediaId={`anime-${animeId}`} 
            mediaType="anime" 
            title={animeInfo?.title}
          />
        </div>
        
        {/* SIDEBAR */}
        <div className={styles.sidebar}>
          {sequelInfo && (
            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>⬇️ Next Season</h3>
              <Link
                href={`/anime/${sequelInfo.id}`}
                className={styles.sequelCard}
              >
                <div className={styles.sequelPoster}>
                  {sequelInfo.image ? (
                    <img src={sequelInfo.image} alt={sequelInfo.title} loading="lazy" />
                  ) : (
                    <div className={styles.noPoster}>🎌</div>
                  )}
                </div>
                <div className={styles.sequelInfo}>
                  <h4>{sequelInfo.title}</h4>
                  {sequelInfo.score && <span>★ {sequelInfo.score}</span>}
                  {sequelInfo.format && (
                    <span className={styles.sequelFormat}>{sequelInfo.format}</span>
                  )}
                </div>
              </Link>
            </div>
          )}
          
          {recommendations.length > 0 && (
            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>✨ Similar Anime</h3>
              <div className={styles.recommendationList}>
                {recommendations.slice(0, 10).map(item => (
                  <Link
                    key={item.id}
                    href={`/anime/${item.id}`}
                    className={styles.recommendationCard}
                  >
                    <div className={styles.recoPoster}>
                      {item.image ? (
                        <img src={item.image} alt={item.title} loading="lazy" />
                      ) : (
                        <div className={styles.noPoster}>🎌</div>
                      )}
                    </div>
                    <div className={styles.recoInfo}>
                      <h4>{item.title}</h4>
                      {item.score && <span>★ {Number(item.score).toFixed(1)}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnimeWatchPage() {
  return (
    <Suspense fallback={
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading player...</p>
      </div>
    }>
      <AnimeWatchContent />
    </Suspense>
  );
}