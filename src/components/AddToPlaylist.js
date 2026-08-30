// src/components/AddToPlaylist.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AddToPlaylist({ mediaId, mediaType, title, poster }) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addedTo, setAddedTo] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    if (user) {
      loadPlaylists();
    }
  }, [user]);
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  async function loadPlaylists() {
    try {
      const { data: playlistData } = await supabase
        .from('playlists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      setPlaylists(playlistData || []);
      
      // Check which playlists already have this media
      if (playlistData && playlistData.length > 0) {
        const playlistIds = playlistData.map(p => p.id);
        const { data: itemsData } = await supabase
          .from('playlist_items')
          .select('playlist_id')
          .in('playlist_id', playlistIds)
          .eq('media_id', String(mediaId));
        
        if (itemsData) {
          setAddedTo(itemsData.map(item => item.playlist_id));
        }
      }
    } catch (error) {
      console.warn('Playlists not available');
    }
  }
  
  async function handleTogglePlaylist(playlistId) {
    if (!user) {
      alert('Please sign in to use playlists');
      return;
    }
    
    setLoading(true);
    
    try {
      if (addedTo.includes(playlistId)) {
        // Remove from playlist
        const { error } = await supabase
          .from('playlist_items')
          .delete()
          .eq('playlist_id', playlistId)
          .eq('media_id', String(mediaId));
        
        if (!error) {
          setAddedTo(prev => prev.filter(id => id !== playlistId));
        }
      } else {
        // Add to playlist
        const { error } = await supabase.from('playlist_items').insert({
          playlist_id: playlistId,
          media_id: String(mediaId),
          media_type: mediaType,
          title: title || null,
          poster: poster || null,
        });
        
        if (!error) {
          setAddedTo(prev => [...prev, playlistId]);
        }
      }
    } catch (error) {
      console.error('Failed to update playlist');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) return;
    
    try {
      const { data, error } = await supabase.from('playlists').insert({
        user_id: user.id,
        name: newPlaylistName.trim(),
      }).select().single();
      
      if (!error && data) {
        setPlaylists(prev => [data, ...prev]);
        setNewPlaylistName('');
        setShowCreate(false);
        
        // Auto add to new playlist
        await supabase.from('playlist_items').insert({
          playlist_id: data.id,
          media_id: String(mediaId),
          media_type: mediaType,
          title: title || null,
          poster: poster || null,
        });
        
        setAddedTo(prev => [...prev, data.id]);
      }
    } catch (error) {
      console.error('Failed to create playlist');
    }
  }
  
  return (
    <div className="playlistContainer" ref={dropdownRef}>
      <button 
        className="playlistButton"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={loading}
      >
        📝 {addedTo.length > 0 ? `In ${addedTo.length} Playlist${addedTo.length > 1 ? 's' : ''}` : 'Add to Playlist'}
      </button>
      
      {showDropdown && (
        <div className="playlistDropdown">
          <h4>Your Playlists</h4>
          
          {playlists.length > 0 ? (
            <div className="playlistOptions">
              {playlists.map(playlist => (
                <button
                  key={playlist.id}
                  className={`playlistOption ${addedTo.includes(playlist.id) ? 'added' : ''}`}
                  onClick={() => handleTogglePlaylist(playlist.id)}
                >
                  <span className="checkbox">
                    {addedTo.includes(playlist.id) ? '✓' : ''}
                  </span>
                  <span className="playlistName">{playlist.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="noPlaylists">No playlists yet</p>
          )}
          
          <div className="playlistDivider"></div>
          
          {showCreate ? (
            <div className="createPlaylistForm">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreatePlaylist();
                  }
                }}
              />
              <div className="createActions">
                <button onClick={handleCreatePlaylist}>Create</button>
                <button onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="createPlaylistButton" onClick={() => setShowCreate(true)}>
              + Create New Playlist
            </button>
          )}
        </div>
      )}
    </div>
  );
}