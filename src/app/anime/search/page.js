// src/app/anime/search/page.jsx - Fixed without lodash, with Suspense
'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('http');
}

// Simple debounce function (no lodash needed)
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function AnimeSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [totalResults, setTotalResults] = useState(0);
  
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 1) {
      setResults([]);
      setSuggestions([]);
      setTotalResults(0);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setShowSuggestions(false);

    try {
      const response = await fetch(`/api/anime-search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await response.json();
      
      const resultsList = Array.isArray(data) ? data : (data.results || []);
      setResults(resultsList);
      setTotalResults(resultsList.length);
      setSuggestions([]);
    } catch (error) {
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(`/api/anime-search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await response.json();
      const resultsList = Array.isArray(data) ? data : (data.results || []);
      
      const titles = resultsList.slice(0, 8).map(item => item.title);
      setSuggestions(titles);
      setShowSuggestions(titles.length > 0);
    } catch (error) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const debouncedFetchSuggestions = useCallback(
    debounce((value) => {
      fetchSuggestions(value);
    }, 300),
    [fetchSuggestions]
  );

  const handleInputChange = (value) => {
    setQuery(value);
    setSelectedIndex(-1);
    
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    router.replace(`/anime/search?${params.toString()}`, { scroll: false });

    debouncedFetchSuggestions(value);
    
    if (!value || value.trim().length < 1) {
      setResults([]);
      setTotalResults(0);
      setHasSearched(false);
      setShowSuggestions(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch(query);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
    
    const params = new URLSearchParams(searchParams);
    params.set('q', suggestion);
    router.replace(`/anime/search?${params.toString()}`, { scroll: false });
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <main className="siteShell">
      <Header />
      
      <div className="searchPageContainer">
        <div className="searchPageHeader">
          <h1>Search Anime</h1>
          <p className="searchSubtitle">Find your favorite anime series</p>
        </div>

        <div className="searchPageContent" ref={searchRef}>
          <form onSubmit={handleSubmit} className="searchPageForm">
            <div className="searchInputWrapper">
              <span className="searchIcon">🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder="Search by title, genre, or studio..."
                autoFocus
                className="searchPageInput"
              />
              {loading && (
                <div className="searchSpinner">
                  <div className="spinner"></div>
                </div>
              )}
            </div>
            <button type="submit" className="searchPageButton" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestionsDropdown">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className={`suggestionItem ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="suggestionIcon">📺</span>
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          {hasSearched && !loading && (
            <div className="searchResults">
              {results.length > 0 ? (
                <>
                  <p className="resultsCount">
                    Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
                  </p>
                  <div className="animeGrid">
                    {results.map((item) => (
                      <Link
                        key={item.id}
                        href={`/anime/${item.id}`}
                        className="animeCard"
                      >
                        <div className="animePoster">
                          {isValidUrl(item.image) ? (
                            <img src={item.image} alt={item.title} loading="lazy" />
                          ) : (
                            <div className="noPoster">🎌</div>
                          )}
                          {item.score && (
                            <span className="animeScore">★ {item.score}</span>
                          )}
                        </div>
                        <div className="animeInfo">
                          <h3>{item.title}</h3>
                          {item.year && <span>{item.year}</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="noResults">
                  <span className="noResultsIcon">🔍</span>
                  <h3>No results found</h3>
                  <p>Try adjusting your search terms</p>
                </div>
              )}
            </div>
          )}

          {!hasSearched && !loading && !query && (
            <div className="searchInitial">
              <span className="searchInitialIcon">🎌</span>
              <h3>Start typing to search</h3>
              <p>Search by title, genre, or studio name</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Wrap in Suspense for build
export default function AnimeSearchPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    }>
      <AnimeSearchContent />
    </Suspense>
  );
}