// src/app/embed/[type]/[id]/page.jsx
'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import RatingStars from '@/components/RatingStars';
import CommentsSection from '@/components/CommentsSection';
import AddToPlaylist from '@/components/AddToPlaylist';
import AutoNext from '@/components/AutoNext';
import ResumePrompt from '@/components/ResumePrompt';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getEmbed, fetchRecommended, getMediaDetails, getSeasonEpisodes } from "@/lib/api";
import styles from './page.module.css';

function EmbedContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const user = auth?.user || null;
  const type = params?.type || 'movie';
  const id = params?.id || '';
  
  const [media, setMedia] = useState(null);
  const [relatedMedia, setRelatedMedia] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(1);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentEmbedUrl, setCurrentEmbedUrl] = useState('');
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [visibleEpisodes, setVisibleEpisodes] = useState(12);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  
  const playerRef = useRef(null);
  const episodesRef = useRef(null);
  
  const isTVShow = type === 'tv' || type === 'series';
  const EPISODES_PER_PAGE = 12;

  const filteredEpisodes = useMemo(() => {
    if (!episodeSearch.trim()) return episodes;
    const searchTerm = episodeSearch.trim().toLowerCase();
    return episodes.filter(ep => {
      const episodeNum = String(ep.episode_number);
      const episodeName = (ep.name || '').toLowerCase();
      return episodeNum.includes(searchTerm) || episodeName.includes(searchTerm);
    });
  }, [episodes, episodeSearch]);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(dataParam));
        setMedia(parsedData);
      } catch (error) {}
    }
    
    loadData();
    checkFavorite();
  }, [type, id, searchParams]);

  async function checkFavorite() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('media_id', String(id))
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
          .eq('media_id', String(id));
        setIsFavorite(false);
      } else {
        await supabase.from('favorites').insert({
          user_id: user.id,
          media_id: String(id),
          media_type: type,
          title: media?.title || null,
          poster: media?.poster_path ? `https://image.tmdb.org/t/p/w200${media.poster_path}` : null,
        });
        setIsFavorite(true);
      }
    } catch (error) {}
  }

  async function loadData() {
    if (!type || !id || id === 'undefined') {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    const decodedType = decodeURIComponent(type);
    const decodedId = decodeURIComponent(id);
    
    setCurrentEmbedUrl(getEmbed(decodedType, decodedId));
    
    if (decodedType === 'tv' || decodedType === 'series') {
      setShowEpisodes(true);
      await loadTVShowData(decodedId);
    }
    
    try {
      const recommendations = await fetchRecommended(decodedId, decodedType);
      setRelatedMedia(recommendations || []);
    } catch (error) {}
    
    setIsLoading(false);
  }

  async function loadTVShowData(tvId) {
    try {
      const details = await getMediaDetails(tvId, 'tv');
      
      if (details) {
        setMedia(prev => ({
          ...prev,
          title: details.name || prev?.title,
          overview: details.overview || prev?.overview,
          year: details.first_air_date?.slice(0, 4) || prev?.year,
          rating: details.vote_average || prev?.rating,
          genres: details.genres?.map(g => g.name).join(', ') || prev?.genres,
          poster_path: details.poster_path || prev?.poster_path,
        }));
        
        if (details.seasons && details.seasons.length > 0) {
          setSeasons(details.seasons.filter(s => s.season_number > 0));
          const firstSeason = details.seasons.find(s => s.season_number > 0)?.season_number || 1;
          setActiveSeason(firstSeason);
          await fetchEpisodesForSeason(tvId, firstSeason);
        }
      }
    } catch (error) {}
  }

  async function fetchEpisodesForSeason(tvId, seasonNumber) {
    try {
      setIsLoadingEpisodes(true);
      setActiveSeason(seasonNumber);
      setVisibleEpisodes(12);
      setEpisodeSearch('');
      setActiveEpisode(null);
      
      const seasonEpisodes = await getSeasonEpisodes(tvId, seasonNumber);
      setEpisodes(seasonEpisodes);
    } catch (error) {
      setEpisodes([]);
    } finally {
      setIsLoadingEpisodes(false);
    }
  }

  function handleEpisodeSelect(episode) {
    setActiveEpisode(episode);
    const embedUrl = getEmbed(decodeURIComponent(type), decodeURIComponent(id), {
      season: episode.season_number || activeSeason,
      episode: episode.episode_number,
    });
    setCurrentEmbedUrl(embedUrl);
    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleNextEpisode() {
    if (!activeEpisode || !episodes.length) return;
    const currentIndex = episodes.findIndex(ep => ep.id === activeEpisode.id);
    if (currentIndex < episodes.length - 1) {
      handleEpisodeSelect(episodes[currentIndex + 1]);
    }
  }

  function handlePrevEpisode() {
    if (!activeEpisode || !episodes.length) return;
    const currentIndex = episodes.findIndex(ep => ep.id === activeEpisode.id);
    if (currentIndex > 0) {
      handleEpisodeSelect(episodes[currentIndex - 1]);
    }
  }

  function loadMoreEpisodes() {
    setVisibleEpisodes(prev => prev + EPISODES_PER_PAGE);
  }

  function handleEpisodeSearch(value) {
    setEpisodeSearch(value);
    setVisibleEpisodes(episodes.length);
  }

  function toggleSynopsis() {
    setShowFullSynopsis(!showFullSynopsis);
  }

  const currentEpisodeIndex = activeEpisode ? episodes.findIndex(ep => ep.id === activeEpisode.id) : -1;
  const hasNextEpisode = currentEpisodeIndex < episodes.length - 1;
  const hasPrevEpisode = currentEpisodeIndex > 0;
  const remainingEpisodes = filteredEpisodes.length - visibleEpisodes;
  const nextEpisode = currentEpisodeIndex >= 0 && currentEpisodeIndex < episodes.length - 1 ? episodes[currentEpisodeIndex + 1] : null;

  if (isLoading) {
    return (
      <div className={styles.watchPage}>
        <Header />
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.watchPage}>
      <Header />
      
      <div className={styles.watchContent}>
        <div className={styles.playerSection}>
          <div className={styles.videoPlayer} ref={playerRef}>
            {currentEmbedUrl ? (
              <iframe
                key={currentEmbedUrl}
                src={currentEmbedUrl}
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
                scrolling="no"
                frameBorder="0"
              />
            ) : (
              <div className={styles.noVideo}>
                <span>🎬</span>
                <p>Video unavailable</p>
              </div>
            )}
          </div>
          
          <AutoNext onNext={handleNextEpisode} nextEpisode={nextEpisode} isTVShow={isTVShow} />
          
          {isTVShow && activeEpisode && (
            <div className={styles.episodeNavigation}>
              <button className={styles.navButton} onClick={handlePrevEpisode} disabled={!hasPrevEpisode}>
                ← Previous
              </button>
              <div className={styles.navInfo}>
                <span className={styles.navEpisode}>
                  S{activeEpisode.season_number || activeSeason} E{activeEpisode.episode_number}
                </span>
                <span className={styles.navEpisodeName}>{activeEpisode.name}</span>
              </div>
              <button className={styles.navButton} onClick={handleNextEpisode} disabled={!hasNextEpisode}>
                Next →
              </button>
            </div>
          )}
          
          <div className={styles.mediaInfo}>
            <div className={styles.titleRow}>
              <h1>{media?.title || 'Now Playing'}</h1>
              {media?.year && <span className={styles.year}>{media.year}</span>}
              <button 
                className={`${styles.favoriteButton} ${isFavorite ? styles.isFavorite : ''}`}
                onClick={toggleFavorite}
              >
                {isFavorite ? '❤️' : '🤍'}
              </button>
            </div>
            
            <div className={styles.mediaMeta}>
              {media?.rating && <span className={styles.rating}>★ {Number(media.rating).toFixed(1)}</span>}
              {media?.genres && <span className={styles.genres}>{media.genres}</span>}
              {seasons.length > 0 && <span>{seasons.length} Seasons</span>}
            </div>
            
            <p className={`${styles.synopsis} ${!showFullSynopsis ? styles.synopsisClamped : ''}`}>
              {media?.overview || 'No synopsis available.'}
            </p>
            {media?.overview && media.overview.length > 150 && (
              <button className={styles.moreButton} onClick={toggleSynopsis}>
                {showFullSynopsis ? 'Show less' : 'Show more'}
              </button>
            )}
            
            <div className={styles.actionRow}>
              <RatingStars
                mediaId={id}
                mediaType={type}
                title={media?.title}
                poster={media?.poster_path ? `https://image.tmdb.org/t/p/w200${media.poster_path}` : null}
                tmdbRating={media?.rating}
              />
              <AddToPlaylist 
                mediaId={id}
                mediaType={type}
                title={media?.title}
                poster={media?.poster_path ? `https://image.tmdb.org/t/p/w200${media.poster_path}` : null}
              />
            </div>
          </div>
          
          {showEpisodes && (
            <div className={styles.episodesSection} ref={episodesRef}>
              <h3 className={styles.episodesTitle}>Season {activeSeason} Episodes</h3>
              
              <input
                type="text"
                placeholder="Search episodes..."
                value={episodeSearch}
                onChange={(e) => handleEpisodeSearch(e.target.value)}
                className={styles.searchInput}
              />
              
              {seasons.length > 1 && (
                <div className={styles.seasonSelector}>
                  {seasons.map(season => (
                    <button
                      key={season.id}
                      className={`${styles.seasonButton} ${activeSeason === season.season_number ? styles.activeSeason : ''}`}
                      onClick={() => fetchEpisodesForSeason(id, season.season_number)}
                    >
                      S{season.season_number}
                    </button>
                  ))}
                </div>
              )}
              
              {isLoadingEpisodes ? (
                <div className={styles.loadingEpisodes}>Loading episodes...</div>
              ) : episodes.length > 0 ? (
                <>
                  <div className={styles.episodeGrid}>
                    {filteredEpisodes.slice(0, visibleEpisodes).map(episode => (
                      <button
                        key={episode.id}
                        className={`${styles.episodeCard} ${activeEpisode?.id === episode.id ? styles.activeEpisodeCard : ''}`}
                        onClick={() => handleEpisodeSelect(episode)}
                      >
                        <div className={styles.episodeThumbnail}>
                          {episode.still_path ? (
                            <img src={`https://image.tmdb.org/t/p/w300${episode.still_path}`} alt={episode.name} loading="lazy" />
                          ) : (
                            <div className={styles.noThumbnail}>🎬</div>
                          )}
                        </div>
                        <div className={styles.episodeInfo}>
                          <span className={styles.episodeNumber}>EP {episode.episode_number}</span>
                          <h4 className={styles.episodeName}>{episode.name}</h4>
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {remainingEpisodes > 0 && (
                    <button className={styles.loadMoreButton} onClick={loadMoreEpisodes}>
                      Load More ({remainingEpisodes})
                    </button>
                  )}
                </>
              ) : (
                <p className={styles.noEpisodesFound}>No episodes found.</p>
              )}
            </div>
          )}
          
          <CommentsSection mediaId={id} mediaType={type} title={media?.title} />
        </div>
        
        <div className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>✨ Recommended</h3>
          <div className={styles.recommendationList}>
            {relatedMedia.length > 0 ? (
              relatedMedia.slice(0, 10).map(item => (
                <Link
                  key={item.id}
                  href={`/embed/${item.media_type || 'movie'}/${item.id}`}
                  className={styles.recommendationCard}
                >
                  <div className={styles.recoPoster}>
                    {item.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt={item.title || item.name} loading="lazy" />
                    ) : (
                      <div className={styles.noPoster}>🎬</div>
                    )}
                  </div>
                  <div className={styles.recoInfo}>
                    <h4>{item.title || item.name}</h4>
                    {item.vote_average > 0 && <span>★ {item.vote_average.toFixed(1)}</span>}
                  </div>
                </Link>
              ))
            ) : (
              <p className={styles.noRecommendations}>Loading...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div className={styles.loadingContainer}><div className={styles.spinner}></div></div>}>
      <EmbedContent />
    </Suspense>
  );
}