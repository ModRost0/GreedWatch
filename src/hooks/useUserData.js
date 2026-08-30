// src/hooks/useUserData.js
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export function useUserData() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  
  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      loadGuestData();
    }
  }, [user]);
  
  async function loadUserData() {
    // Load favorites
    const { data: favData } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id);
    setFavorites(favData || []);
    
    // Load watch history
    const { data: historyData } = await supabase
      .from('watch_history')
      .select('*')
      .eq('user_id', user.id)
      .order('watched_at', { ascending: false });
    setWatchHistory(historyData || []);
  }
  
  function loadGuestData() {
    const guestFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const guestHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
    setFavorites(guestFavorites);
    setWatchHistory(guestHistory);
  }
  
  async function toggleFavorite(mediaId, mediaType, title, poster) {
    if (user) {
      // Check if already favorited
      const existing = favorites.find(f => f.media_id === mediaId);
      
      if (existing) {
        await supabase.from('favorites').delete().eq('id', existing.id);
      } else {
        await supabase.from('favorites').insert({
          user_id: user.id,
          media_id: mediaId,
          media_type: mediaType,
          title,
          poster,
        });
      }
      loadUserData();
    } else {
      // Guest - use localStorage
      let guestFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
      const existing = guestFavorites.find(f => f.media_id === mediaId);
      
      if (existing) {
        guestFavorites = guestFavorites.filter(f => f.media_id !== mediaId);
      } else {
        guestFavorites.push({ media_id: mediaId, media_type: mediaType, title, poster });
      }
      
      localStorage.setItem('favorites', JSON.stringify(guestFavorites));
      setFavorites(guestFavorites);
    }
  }
  
  async function addToHistory(mediaId, mediaType, title, poster, season = null, episode = null) {
    const historyItem = {
      media_id: mediaId,
      media_type: mediaType,
      title,
      poster,
      season,
      episode,
      watched_at: new Date().toISOString(),
    };
    
    if (user) {
      await supabase.from('watch_history').upsert(
        { user_id: user.id, ...historyItem },
        { onConflict: 'user_id,media_id,season,episode' }
      );
      loadUserData();
    } else {
      let guestHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
      guestHistory.unshift(historyItem);
      guestHistory = guestHistory.slice(0, 50);
      localStorage.setItem('watchHistory', JSON.stringify(guestHistory));
      setWatchHistory(guestHistory);
    }
  }
  
  return {
    favorites,
    watchHistory,
    toggleFavorite,
    addToHistory,
  };
}