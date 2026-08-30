// src/components/AnimeInfiniteScroll.jsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

export default function AnimeInfiniteScroll({ initialItems = [] }) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const loaderRef = useRef(null);
  
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    
    try {
      const nextPage = page + 1;
      const response = await fetch(`/api/anime-more?page=${nextPage}&perPage=20`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        setItems(prev => [...prev, ...data]);
        setPage(nextPage);
        setHasMore(data.length >= 20);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);
  
  function isValidUrl(url) {
    return typeof url === 'string' && url.startsWith('http');
  }
  
  return (
    <>
      <div className="animeGrid">
        {items.map((anime, index) => (
          <Link 
            key={`${anime.id}-${index}`}
            href={`/anime/${anime.id}`}
            className="animeCard"
          >
            <div className="animePoster">
              {isValidUrl(anime.image) ? (
                <img src={anime.image} alt={anime.title} loading="lazy" />
              ) : (
                <div className="noPoster">🎌</div>
              )}
              {anime.score && (
                <span className="animeScore">★ {Number(anime.score).toFixed(1)}</span>
              )}
              {anime.episodes && (
                <span className="animeEpisodes">{anime.episodes} eps</span>
              )}
            </div>
            <div className="animeInfo">
              <h3>{anime.title}</h3>
              {anime.year && <span>{anime.year}</span>}
            </div>
          </Link>
        ))}
      </div>
      
      <div ref={loaderRef} className="infiniteLoader">
        {loading && (
          <div className="loaderSpinner">
            <div className="spinner"></div>
            <p>Loading more...</p>
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <p className="endMessage">You've reached the end! 🎌</p>
        )}
      </div>
    </>
  );
}