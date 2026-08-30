// src/app/anime/search/page.jsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import debounce from 'lodash/debounce';

const ANILIST_API = 'https://graphql.anilist.co';

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('http');
}

export default function AnimeSearchPage() {
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

  // Perform search
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
      
      setResults(data.results || []);
      setTotalResults(data.total || 0);
      setSuggestions([]);
    } catch (error) {
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get suggestions as user types
  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(`/api/anime-search?q=${encodeURIComponent(searchQuery.trim())}&suggest=true`);
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setShowSuggestions(data.suggestions?.length > 0);
    } catch (error) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  // Debounced suggestion fetch
  const debouncedFetchSuggestions = useCallback(
    debounce((value) => {
      fetchSuggestions(value);
    }, 300),
    [fetchSuggestions]
  );

  // Handle input change
  const handleInputChange = (value) => {
    setQuery(value);
    setSelectedIndex(-1);
    
    // Update URL without page reload
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    router.replace(`/anime/search?${params.toString()}`, { scroll: false });

    // Fetch suggestions
    debouncedFetchSuggestions(value);
    
    // Clear results if query is empty
    if (!value || value.trim().length < 1) {
      setResults([]);
      setTotalResults(0);
      setHasSearched(false);
      setShowSuggestions(false);
    }
  };

  // Handle search submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch(query);
      setShowSuggestions(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
    
    // Update URL
    const params = new URLSearchParams(searchParams);
    params.set('q', suggestion);
    router.replace(`/anime/search?${params.toString()}`, { scroll: false });
  };

  // Handle keyboard navigation
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

  // Initial search from URL
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, []);

  // Click outside handler
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

          {/* Suggestions Dropdown */}
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

          {/* Results */}
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
                          {item.format && (
                            <span className="animeFormat">{item.format}</span>
                          )}
                        </div>
                        <div className="animeInfo">
                          <h3>{item.title}</h3>
                          {item.year && <span>{item.year}</span>}
                          {item.genres && item.genres.length > 0 && (
                            <span className="animeGenres">
                              {item.genres.slice(0, 3).join(' • ')}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="noResults">
                  <span className="noResultsIcon">🔍</span>
                  <h3>No results found</h3>
                  <p>Try adjusting your search terms or browse our collections</p>
                  <div className="noResultsActions">
                    <Link href="/anime" className="button buttonLight">
                      Browse All Anime
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Initial state - no search yet */}
          {!hasSearched && !loading && !query && (
            <div className="searchInitial">
              <span className="searchInitialIcon">🎌</span>
              <h3>Start typing to search</h3>
              <p>Search by title, genre, or studio name</p>
              <div className="searchTips">
                <span>💡 Try: "Attack on Titan"</span>
                <span>💡 Try: "Romance"</span>
                <span>💡 Try: "Studio Ghibli"</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}