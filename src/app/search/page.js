// src/app/search/page.jsx - With filters
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('http');
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, movie, tv
  const [filterYear, setFilterYear] = useState('all');
  const [filterRating, setFilterRating] = useState(0);
  const [sortBy, setSortBy] = useState('popularity'); // popularity, rating, date, title
  const debounceRef = useRef(null);
  const searchRef = useRef(null);

  const years = ['all', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2010-2015', '2000-2010', 'before-2000'];
  const ratings = [0, 5, 6, 7, 8, 9];

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...results];
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.media_type === filterType);
    }
    
    // Filter by year
    if (filterYear !== 'all') {
      const year = filterYear;
      filtered = filtered.filter(item => {
        const itemYear = (item.release_date || item.first_air_date || '').slice(0, 4);
        
        if (year === '2010-2015') {
          return itemYear >= '2010' && itemYear <= '2015';
        }
        if (year === '2000-2010') {
          return itemYear >= '2000' && itemYear <= '2010';
        }
        if (year === 'before-2000') {
          return itemYear < '2000';
        }
        return itemYear === year;
      });
    }
    
    // Filter by rating
    if (filterRating > 0) {
      filtered = filtered.filter(item => (item.vote_average || 0) >= filterRating);
    }
    
    // Sort
    switch (sortBy) {
      case 'rating':
        filtered.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        break;
      case 'date':
        filtered.sort((a, b) => 
          (b.release_date || b.first_air_date || '').localeCompare(a.release_date || a.first_air_date || '')
        );
        break;
      case 'title':
        filtered.sort((a, b) => 
          (a.title || a.name || '').localeCompare(b.title || b.name || '')
        );
        break;
      default:
        filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }
    
    setFilteredResults(filtered);
  }, [results, filterType, filterYear, filterRating, sortBy]);

  async function performSearch(searchQuery) {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    setShowDropdown(true);
    
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
    
    if (value.trim().length < 1) {
      setResults([]);
      setFilteredResults([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setShowDropdown(true);
    
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }

  function clearFilters() {
    setFilterType('all');
    setFilterYear('all');
    setFilterRating(0);
    setSortBy('popularity');
  }

  const hasActiveFilters = filterType !== 'all' || filterYear !== 'all' || filterRating > 0;

  return (
    <main className="siteShell">
      <Header />
      
      <div style={{ maxWidth: '800px', margin: '30px auto', padding: '0 20px', position: 'relative' }} ref={searchRef}>
        {/* Search Input */}
        <form onSubmit={(e) => { e.preventDefault(); performSearch(query); }} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search movies and TV shows..."
            autoFocus
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
          />
          <button type="submit" disabled={loading} style={{
            padding: '15px 30px',
            background: '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: '25px',
            cursor: 'pointer',
            fontWeight: '600',
          }}>
            {loading ? 'Searching...' : '🔍 Search'}
          </button>
        </form>
        
        {/* Dropdown */}
        {showDropdown && results.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: '20px',
            right: '20px',
            background: '#1a1a1a',
            border: '1px solid rgba(76, 175, 80, 0.3)',
            borderRadius: '10px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 1000,
          }}>
            {results.slice(0, 10).map(item => (
              <Link
                key={item.id}
                href={`/show/${item.id}?type=${item.media_type || 'movie'}`}
                onClick={() => setShowDropdown(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 15px',
                  textDecoration: 'none',
                  color: '#fff',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(76, 175, 80, 0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {item.poster_path && (
                  <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt={item.title || item.name} style={{ width: '35px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                )}
                <div>
                  <span style={{ display: 'block', fontWeight: '500' }}>{item.title || item.name}</span>
                  <span style={{ fontSize: '0.8rem', color: '#999' }}>
                    {(item.release_date || item.first_air_date || '').slice(0, 4)} • {item.media_type === 'tv' ? 'TV' : 'Movie'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      
      {/* Filter Bar */}
      {results.length > 0 && !loading && (
        <div style={{
          maxWidth: '800px',
          margin: '20px auto',
          padding: '15px 20px',
          background: '#1a1a1a',
          border: '1px solid rgba(76, 175, 80, 0.2)',
          borderRadius: '10px',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {/* Type Filter */}
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={() => setFilterType('all')}
              style={{
                padding: '6px 14px',
                background: filterType === 'all' ? '#4caf50' : 'rgba(255,255,255,0.1)',
                color: filterType === 'all' ? '#fff' : '#ccc',
                border: 'none',
                borderRadius: '15px',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('movie')}
              style={{
                padding: '6px 14px',
                background: filterType === 'movie' ? '#4caf50' : 'rgba(255,255,255,0.1)',
                color: filterType === 'movie' ? '#fff' : '#ccc',
                border: 'none',
                borderRadius: '15px',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Movies
            </button>
            <button
              onClick={() => setFilterType('tv')}
              style={{
                padding: '6px 14px',
                background: filterType === 'tv' ? '#4caf50' : 'rgba(255,255,255,0.1)',
                color: filterType === 'tv' ? '#fff' : '#ccc',
                border: 'none',
                borderRadius: '15px',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              TV Shows
            </button>
          </div>
          
          {/* Year Filter */}
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: '1px solid rgba(76,175,80,0.3)',
              borderRadius: '15px',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {years.map(year => (
              <option key={year} value={year} style={{ background: '#1a1a1a' }}>
                {year === 'all' ? 'All Years' : year}
              </option>
            ))}
          </select>
          
          {/* Rating Filter */}
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(Number(e.target.value))}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: '1px solid rgba(76,175,80,0.3)',
              borderRadius: '15px',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {ratings.map(r => (
              <option key={r} value={r} style={{ background: '#1a1a1a' }}>
                {r === 0 ? 'All Ratings' : `${r}+ Stars`}
              </option>
            ))}
          </select>
          
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: '1px solid rgba(76,175,80,0.3)',
              borderRadius: '15px',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            <option value="popularity" style={{ background: '#1a1a1a' }}>Most Popular</option>
            <option value="rating" style={{ background: '#1a1a1a' }}>Highest Rated</option>
            <option value="date" style={{ background: '#1a1a1a' }}>Newest First</option>
            <option value="title" style={{ background: '#1a1a1a' }}>A-Z</option>
          </select>
          
          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                padding: '6px 14px',
                background: 'rgba(255,0,0,0.1)',
                color: '#ff6b6b',
                border: '1px solid rgba(255,0,0,0.3)',
                borderRadius: '15px',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}
      
      {/* Results */}
      {!loading && hasSearched && (
        <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 20px' }}>
          <p style={{ color: '#999', marginBottom: '15px' }}>
            {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
            {hasActiveFilters && ' (filtered)'}
          </p>
          <div className="catalogGrid">
            {filteredResults.map(item => (
              <Link key={item.id} href={`/show/${item.id}?type=${item.media_type || 'movie'}`} className="catalogItem">
                <div className="catalogPoster">
                  {item.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt={item.title || item.name} loading="lazy" />
                  ) : (
                    <div className="noPoster">🎬</div>
                  )}
                  <span className="cardScore">★ {item.vote_average?.toFixed(1) || "—"}</span>
                </div>
                <h3>{item.title || item.name}</h3>
                <p>{(item.release_date || item.first_air_date || '').slice(0, 4)} • {item.media_type === 'tv' ? 'TV' : 'Movie'}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}