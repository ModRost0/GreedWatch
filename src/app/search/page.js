// src/app/search/page.jsx - Fixed with instant content
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { getPopularMovies, getPopularTv } from '@/lib/api';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [popularMovies, setPopularMovies] = useState([]);
  const [popularTv, setPopularTv] = useState([]);
  const debounceRef = useRef(null);
  
  // Load popular content immediately
  useEffect(() => {
    getPopularMovies().then(setPopularMovies).catch(() => {});
    getPopularTv().then(setPopularTv).catch(() => {});
  }, []);
  
  // Auto-search if query from homepage
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);
  
  async function performSearch(searchQuery) {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setResults(data || []);
    } catch (error) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }
  
  function handleInputChange(value) {
    setQuery(value);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setResults(data || []);
      } catch (error) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }
  
  return (
    <main className="siteShell">
      <Header />
      
      <div style={{ maxWidth: '800px', margin: '30px auto', padding: '0 20px' }}>
        {/* Search Input */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search movies and TV shows..."
            style={{
              flex: 1,
              padding: '15px 20px',
              background: 'rgba(76, 175, 80, 0.1)',
              border: '2px solid #4caf50',
              borderRadius: '25px',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none',
            }}
            autoFocus
          />
        </div>
        
        {/* Loading indicator */}
        {loading && (
          <p style={{ textAlign: 'center', color: '#999' }}>Searching...</p>
        )}
        
        {/* Search Results */}
        {!loading && results.length > 0 && (
          <div>
            <p style={{ color: '#999', marginBottom: '15px' }}>
              {results.length} results
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
              {results.map(item => {
                const title = item.title || item.name || 'Unknown';
                const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
                
                return (
                  <Link
                    key={item.id}
                    href={`/show/${item.id}?type=${mediaType}`}
                    style={{ textDecoration: 'none', color: '#fff' }}
                  >
                    <div style={{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '2/3', background: '#1a1a1a' }}>
                      {item.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt={title} loading="lazy" />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '40px' }}>🎬</div>
                      )}
                    </div>
                    <h3 style={{ margin: '10px 0 5px', fontSize: '0.9rem' }}>{title}</h3>
                    <p style={{ color: '#999', fontSize: '0.8rem' }}>
                      {(item.release_date || item.first_air_date || '').slice(0, 4)} • ★ {item.vote_average?.toFixed(1)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Show popular content when no search */}
        {!loading && results.length === 0 && (
          <div>
            {/* Popular Movies */}
            {popularMovies.length > 0 && (
              <section className="shelf">
                <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>Popular Movies</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
                  {popularMovies.slice(0, 8).map(item => (
                    <Link
                      key={item.id}
                      href={`/show/${item.id}?type=movie`}
                      style={{ textDecoration: 'none', color: '#fff' }}
                    >
                      <div style={{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '2/3', background: '#1a1a1a' }}>
                        {item.poster_path ? (
                          <img src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt={item.title} loading="lazy" />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '40px' }}>🎬</div>
                        )}
                      </div>
                      <h3 style={{ margin: '10px 0 5px', fontSize: '0.9rem' }}>{item.title}</h3>
                      <p style={{ color: '#999', fontSize: '0.8rem' }}>{item.release_date?.slice(0, 4)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            
            {/* Popular TV */}
            {popularTv.length > 0 && (
              <section className="shelf">
                <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>Popular TV Shows</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
                  {popularTv.slice(0, 8).map(item => (
                    <Link
                      key={item.id}
                      href={`/show/${item.id}?type=tv`}
                      style={{ textDecoration: 'none', color: '#fff' }}
                    >
                      <div style={{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '2/3', background: '#1a1a1a' }}>
                        {item.poster_path ? (
                          <img src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt={item.name} loading="lazy" />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '40px' }}>🎬</div>
                        )}
                      </div>
                      <h3 style={{ margin: '10px 0 5px', fontSize: '0.9rem' }}>{item.name}</h3>
                      <p style={{ color: '#999', fontSize: '0.8rem' }}>{item.first_air_date?.slice(0, 4)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
