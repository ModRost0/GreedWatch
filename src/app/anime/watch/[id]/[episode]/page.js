// src/app/anime/watch/[id]/[episode]/page.jsx - Full with logging, MegaVid default
'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
      const url = `https://megavid.buzz/ani/${animeId}/${episode}/${audioParam}?color=%234caf50&autoplay=true`;
      console.log('🔧 [MegaVid] URL:', url);
      return url;
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
      const url = `https://anixo.buzz/embed/ani/${animeId}/${episode}/${audio}?color=%234caf50`;
      console.log('🔧 [AniXo] URL:', url);
      console.log('🔧 [AniXo] Note: May redirect to main site if embed not supported');
      return url;
    },
    supportsAudio: ['sub', 'dub'],
  },
};

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
  
  useEffect(() => {
    loadRatings();
    if (user) loadUserRating();
  }, [mediaId, user]);
  
  async function loadRatings() {
    try {
      const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('media_id', String(mediaId));
      
      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(avg);
        setTotalRatings(data.length);
      }
    } catch (error) {}
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
    } catch (error) {}
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
      loadRatings();
    } catch (error) {}
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
          >
            ★
          </button>
        ))}
      </div>
      <span className={styles.ratingInfo}>
        {totalRatings > 0 ? (
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
  const auth = useAuth();
  const user = auth?.user || null;
  const animeId = params?.id;
  const episodeNumber = Number(params?.episode) || 1;
  
  const [animeInfo, setAnimeInfo] = useState(null);
  const [airedEpisodes, setAiredEpisodes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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
  
  const playerRef = useRef(null);

  console.log('🎬 [Watch] Mounted - Anime:', animeId, 'EP:', episodeNumber);

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
    console.log('🔄 [Server] Switching to:', serverId);
    if (serverId === currentServer) return;
    setCurrentServer(serverId);
    setPlayerLoading(true);
    setPlayerError(false);
    setIframeKey(prev => prev + 1);
  };

  useEffect(() => {
    console.log('📡 [Data] Loading anime data...');
    if (animeId) {
      loadAnimeData();
      checkFavorite();
    }
  }, [animeId]);

  async function loadAnimeData() {
    setIsLoading(true);
    
    try {
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
            isAdult
            studios { nodes { name } }
            nextAiringEpisode { episode airingAt }
            airingSchedule { nodes { episode airingAt } }
          }
        }
      `;
      
      const response = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { id: Number(animeId) } }),
      });
      
      console.log('📡 [Data] AniList status:', response.status);
      
      const data = await response.json();
      const media = data?.data?.Media;
      
      if (media) {
        console.log('✅ [Data] Found:', media.title?.english || media.title?.romaji);
        
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
        });
        
        await loadRecommendations(media.genres || [], media.id);
        
        const now = Math.floor(Date.now() / 1000);
        let episodeList = [];
        
        if (media.status === 'FINISHED' && media.episodes) {
          episodeList = Array.from({ length: media.episodes }, (_, i) => i + 1);
          console.log('📺 [Episodes] FINISHED -', media.episodes, 'eps');
        } else {
          const airedNodes = (media.airingSchedule?.nodes || [])
            .filter(node => node.airingAt && node.airingAt <= now);
          const airedNumbers = airedNodes.map(n => n.episode);
          
          if (airedNumbers.length > 0) {
            const maxAired = Math.max(...airedNumbers);
            episodeList = Array.from({ length: maxAired }, (_, i) => i + 1);
            console.log('📺 [Episodes] Aired:', maxAired);
          } else if (media.nextAiringEpisode?.episode > 1) {
            episodeList = Array.from({ length: media.nextAiringEpisode.episode - 1 }, (_, i) => i + 1);
          } else {
            episodeList = [1];
          }
        }
        
        setAiredEpisodes(episodeList);
        console.log('✅ [Episodes] Total:', episodeList.length);
      }
      
    } catch (error) {
      console.error('❌ [Data] Error:', error.message);
    } finally {
      setIsLoading(false);
    }
  }

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
      
      const response = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { genres: genreNames, excludeId: Number(currentAnimeId) } }),
      });
      
      const data = await response.json();
      setRecommendations((data?.data?.Page?.media || []).map(item => ({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || 'Unknown',
        image: item.coverImage?.large || null,
        score: item.averageScore ? (item.averageScore / 10).toFixed(1) : null,
      })));
    } catch (error) {
      setRecommendations([]);
    }
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
    } catch (error) {}
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
    } catch (error) {}
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
    } catch (error) {}
  }

  function handleEpisodeChange(newEpisode) {
    console.log('📺 [Episode] Changing to:', newEpisode);
    setCurrentEpisode(newEpisode);
    setHasTrackedWatch(false);
    setPlayerLoading(true);
    setPlayerError(false);
    setIframeKey(prev => prev + 1);
    window.history.pushState({}, '', `/anime/watch/${animeId}/${newEpisode}`);
    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleAudioChange(audio) {
    console.log('🔊 [Audio] Changing to:', audio);
    setCurrentAudio(audio);
    setPlayerLoading(true);
    setPlayerError(false);
    setIframeKey(prev => prev + 1);
    const available = getAvailableServers();
    if (available.length > 0) {
      setCurrentServer(available[0].id);
    }
  }

  useEffect(() => {
    if (!playerLoading && !playerError) {
      const timer = setTimeout(() => trackWatch(), 5000);
      return () => clearTimeout(timer);
    }
  }, [playerLoading, playerError, currentEpisode]);

  const handleSdkLoad = () => {
    console.log('✅ [SDK] AniXo SDK loaded');
    setSdkLoaded(true);
  };

  const currentServerConfig = SERVERS[currentServer];
  const needsSdk = currentServerConfig?.requiresSdk || false;

  const getTimeUntilNext = () => {
    if (!animeInfo?.nextAiring?.airingAt) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = animeInfo.nextAiring.airingAt - now;
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return `${days}d ${hours}h`;
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
            console.log('❌ [SDK] AniXo SDK failed');
            setSdkLoaded(true);
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
                <p>No streams found for this episode</p>
                <button 
                  className={styles.retryButton}
                  onClick={() => {
                    setPlayerError(false);
                    setPlayerLoading(true);
                    setIframeKey(prev => prev + 1);
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            
            <iframe
              key={iframeKey}
              src={getEmbedUrl()}
              className={styles.playerIframe}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              scrolling="no"
              frameBorder="0"
              onLoad={() => {
                console.log('✅ [Player] Iframe loaded');
                setPlayerLoading(false);
                setPlayerError(false);
              }}
              onError={() => {
                console.log('❌ [Player] Iframe error for:', currentServer);
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
          
          <div className={styles.episodesSection}>
            <div className={styles.episodesHeader}>
              <h3 className={styles.episodesTitle}>Episodes ({airedEpisodes.length} aired)</h3>
              {timeUntilNext && animeInfo?.status !== 'FINISHED' && (
                <span className={styles.nextEpisodeBadge}>
                  Next: Ep {animeInfo.nextAiring?.episode || airedEpisodes.length + 1} in {timeUntilNext}
                </span>
              )}
            </div>
            <div className={styles.animeEpisodesGrid}>
              {airedEpisodes.map(ep => (
                <button
                  key={ep}
                  className={`${styles.animeEpisodeCard} ${currentEpisode === ep ? styles.activeEpisode : ''}`}
                  onClick={() => handleEpisodeChange(ep)}
                >
                  <span className={styles.episodeNumber}>EP {ep}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className={styles.episodeNavigation}>
            <button 
              className={styles.navButton} 
              onClick={() => handleEpisodeChange(currentEpisode - 1)} 
              disabled={currentEpisode <= 1}
            >
              ← Previous
            </button>
            <span className={styles.navInfo}>Episode {currentEpisode}</span>
            <button 
              className={styles.navButton} 
              onClick={() => handleEpisodeChange(currentEpisode + 1)} 
              disabled={currentEpisode >= airedEpisodes.length}
            >
              Next →
            </button>
          </div>
          
          <div className={styles.mediaInfo}>
            <div className={styles.titleRow}>
              <h1>{animeInfo?.title || 'Unknown'}</h1>
              {animeInfo?.year && <span className={styles.year}>{animeInfo.year}</span>}
              {animeInfo?.episodes && <span className={styles.episodeCount}>{animeInfo.episodes} eps</span>}
              {animeInfo?.status && <span className={`${styles.statusBadge} ${styles[animeInfo.status.toLowerCase()]}`}>{animeInfo.status}</span>}
              {animeInfo?.format && <span className={styles.formatBadge}>{animeInfo.format}</span>}
              {animeInfo?.duration && <span className={styles.durationBadge}>{animeInfo.duration} min</span>}
              <button 
                className={`${styles.favoriteButton} ${isFavorite ? styles.isFavorite : ''}`}
                onClick={toggleFavorite}
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
        
        <div className={styles.sidebar}>
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
    <Suspense fallback={<div className={styles.loadingContainer}><div className={styles.spinner}></div></div>}>
      <AnimeWatchContent />
    </Suspense>
  );
}