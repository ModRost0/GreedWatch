'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';

export default function TrendingShelf({ items }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  useEffect(() => {
    checkScroll();
  }, [items]);
  
  function checkScroll() {
    const ref = scrollRef.current;
    if (ref) {
      setCanScrollLeft(ref.scrollLeft > 0);
      setCanScrollRight(ref.scrollLeft < ref.scrollWidth - ref.clientWidth - 10);
    }
  }
  
  function scrollLeft() {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
  }
  
  function scrollRight() {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
  }
  
  if (!items || items.length === 0) return null;
  
  return (
    <section className="shelf trendingShelf">
      <div className="shelfHead">
        <h2>🔥 Trending Now</h2>
        <div className="scrollButtons">
          <button className="scrollButton" onClick={scrollLeft} disabled={!canScrollLeft}>←</button>
          <button className="scrollButton" onClick={scrollRight} disabled={!canScrollRight}>→</button>
        </div>
      </div>
      
      <div className="trendingScroll" ref={scrollRef} onScroll={checkScroll}>
        {items.slice(0, 10).map((item, index) => (
          <Link 
            key={item.id}
            href={`/show/${encodeURIComponent(item.displayTitle)}?id=${item.id}&type=${item.media_type}`}
            className="trendingCard"
          >
            <div className="trendingRank">#{index + 1}</div>
            <div className="trendingPoster">
              {item.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w185${item.poster_path}`} alt={item.displayTitle} loading="lazy" />
              ) : (
                <div className="noPoster">🎬</div>
              )}
            </div>
            <div className="trendingInfo">
              <h3>{item.displayTitle}</h3>
              <span>★ {item.vote_average?.toFixed(1)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}