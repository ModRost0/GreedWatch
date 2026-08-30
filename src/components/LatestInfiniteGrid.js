// src/components/LatestInfiniteGrid.jsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('http');
}

export default function LatestInfiniteGrid({ initialItems, initialHasNextPage, initialCursor = 2 }) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [loading, setLoading] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const itemsRef = useRef(items); // avoids stale-closure id list on rapid successive loads

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const excludeIds = itemsRef.current.map(item => item.id).join(',');
      const response = await fetch(
        `/api/anime/latest?cursor=${cursor}&exclude=${encodeURIComponent(excludeIds)}`
      );
      const data = await response.json();

      if (data.items?.length) {
        setItems(prev => [...prev, ...data.items]);
      }
      setCursor(data.nextCursor || cursor + 1);
      setHasNextPage(Boolean(data.hasNextPage));
    } catch (error) {
      setHasNextPage(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => setIsIntersecting(entries[0].isIntersecting),
      { rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isIntersecting && hasNextPage && !loading) {
      loadMore();
    }
  }, [isIntersecting, hasNextPage, loading, loadMore]);

  return (
    <>
      <div className="animeGrid">
        {items.map(anime => (
          <Link key={anime.id} href={`/anime/${anime.id}`} className="animeCard">
            <div className="animePoster">
              {isValidUrl(anime.image) ? (
                <img src={anime.image} alt={anime.title} loading="lazy" />
              ) : (
                <div className="noPoster">🎌</div>
              )}
              {anime.score && <span className="animeScore">★ {anime.score}</span>}
            </div>
            <div className="animeInfo">
              <h3>{anime.title}</h3>
              <span className="animeMeta">
                {[anime.format, anime.season, anime.year].filter(Boolean).join(' · ')}
              </span>
              {(anime.episode || anime.airedAgo) && (
                <span className="animeAirInfo">
                  {anime.episode ? `Ep ${anime.episode}` : ''}
                  {anime.episode && anime.airedAgo ? ' · ' : ''}
                  {anime.airedAgo || ''}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {items.length === 0 && !loading && (
        <p className="empty">No anime available.</p>
      )}

      <div ref={sentinelRef} className="infiniteSentinel" />

      {loading && <p className="infiniteLoading">Loading more…</p>}
      {!hasNextPage && items.length > 0 && (
        <p className="infiniteEnd">You've reached the end.</p>
      )}

      <style jsx>{`
        .infiniteSentinel {
          height: 1px;
        }
        .infiniteLoading,
        .infiniteEnd {
          text-align: center;
          color: #6b7280;
          font-size: 13px;
          padding: 24px 0;
        }
      `}</style>
    </>
  );
}