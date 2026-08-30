'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ContinueWatching() {
  const [items, setItems] = useState([]);
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('watchHistory');
      if (saved) {
        const history = JSON.parse(saved);
        
        // Group by media
        const grouped = new Map();
        history.forEach(item => {
          const key = `${item.media_type}-${item.media_id}`;
          if (!grouped.has(key)) {
            grouped.set(key, item);
          }
        });
        
        setItems(Array.from(grouped.values()).slice(0, 8));
      }
    } catch (error) {}
  }, []);
  
  if (items.length === 0) return null;
  
  return (
    <section className="shelf continueWatching">
      <div className="shelfHead">
        <h2>Continue Watching</h2>
      </div>
      <div className="catalogGrid">
        {items.map((item, index) => (
          <Link 
            key={index}
            href={`/embed/${item.media_type}/${item.media_id}`}
            className="catalogItem"
          >
            <div className="catalogPoster">
              {item.poster ? (
                <img src={item.poster} alt={item.title} loading="lazy" />
              ) : (
                <div className="noPoster">🎬</div>
              )}
            </div>
            <h3>{item.title}</h3>
            <p>{item.season ? `S${item.season} E${item.episode}` : ''}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}