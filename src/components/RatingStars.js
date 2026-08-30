// src/components/RatingStars.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function RatingStars({ 
  mediaId, 
  mediaType, 
  title, 
  poster, 
  season = null, 
  episode = null,
  tmdbRating = null,
  tmdbVoteCount = null,
  onRated = null,
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [isRating, setIsRating] = useState(false);
  const [tableExists, setTableExists] = useState(true);
  
  useEffect(() => {
    loadRatings();
    if (user) {
      loadUserRating();
    }
  }, [mediaId, season, episode, user]);
  
  async function loadRatings() {
    try {
      let query = supabase
        .from('ratings')
        .select('rating')
        .eq('media_id', String(mediaId))
        .eq('media_type', mediaType);
      
      if (season !== null && episode !== null) {
        query = query.eq('season', season).eq('episode', episode);
      } else {
        query = query.is('season', null).is('episode', null);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.warn('Ratings table not available:', error.message);
        setTableExists(false);
        setAverageRating(0);
        setTotalRatings(0);
        return;
      }
      
      setTableExists(true);
      
      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(avg);
        setTotalRatings(data.length);
      } else {
        setAverageRating(0);
        setTotalRatings(0);
      }
    } catch (error) {
      console.warn('Ratings not available');
      setTableExists(false);
    }
  }
  
  async function loadUserRating() {
    try {
      let query = supabase
        .from('ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('media_id', String(mediaId))
        .eq('media_type', mediaType);
      
      if (season !== null && episode !== null) {
        query = query.eq('season', season).eq('episode', episode);
      } else {
        query = query.is('season', null).is('episode', null);
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (!error && data) {
        setRating(data.rating);
      }
    } catch (error) {
      console.warn('User rating not available');
    }
  }
  
  async function handleRate(value) {
    if (!user) {
      alert('Please sign in to rate');
      return;
    }
    
    if (!tableExists) {
      alert('Ratings are not set up yet. Please run the SQL schema.');
      return;
    }
    
    setIsRating(true);
    setRating(value);
    
    try {
      const ratingData = {
        user_id: user.id,
        media_id: String(mediaId),
        media_type: mediaType,
        title: title || null,
        poster: poster || null,
        season: season,
        episode: episode,
        rating: value,
        updated_at: new Date().toISOString(),
      };
      
      // Check if existing rating
      let query = supabase
        .from('ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('media_id', String(mediaId))
        .eq('media_type', mediaType);
      
      if (season !== null && episode !== null) {
        query = query.eq('season', season).eq('episode', episode);
      } else {
        query = query.is('season', null).is('episode', null);
      }
      
      const { data: existing } = await query.maybeSingle();
      
      let result;
      if (existing) {
        // Update existing
        result = await supabase
          .from('ratings')
          .update({ rating: value, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        // Insert new
        result = await supabase.from('ratings').insert(ratingData);
      }
      
      if (result.error) {
        console.error('Failed to save rating:', result.error);
        throw result.error;
      }
      
      await loadRatings();
      if (onRated) onRated(value);
    } catch (error) {
      console.error('Failed to rate:', error);
      alert('Failed to save rating. Please try again.');
      setRating(0);
    } finally {
      setIsRating(false);
    }
  }
  
  return (
    <div className="ratingContainer">
      <div className="ratingStarsRow">
        <div className="starsDisplay">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              className={`starButton ${star <= (hoverRating || rating) ? 'active' : ''}`}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => handleRate(star)}
              disabled={isRating || !tableExists}
              title={tableExists ? `Rate ${star} stars` : 'Ratings not available'}
            >
              ★
            </button>
          ))}
        </div>
        
        <div className="ratingInfo">
          {totalRatings > 0 ? (
            <span>
              <strong>{averageRating.toFixed(1)}</strong> ({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})
            </span>
          ) : tmdbRating ? (
            <span className="tmdbRating">
              TMDB: <strong>{tmdbRating.toFixed(1)}</strong> ({tmdbVoteCount?.toLocaleString() || 'N/A'} votes)
            </span>
          ) : (
            <span className="noRatings">No ratings yet</span>
          )}
        </div>
      </div>
    </div>
  );
}