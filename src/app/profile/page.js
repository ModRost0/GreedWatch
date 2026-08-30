// src/app/profile/page.jsx - Add Achievements to profile
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Achievements from '@/components/Achievements';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistItems, setPlaylistItems] = useState([]);
  const [showPlaylistItems, setShowPlaylistItems] = useState(false);
  
  const [editForm, setEditForm] = useState({
    username: '',
    full_name: '',
    bio: '',
    avatar_url: '',
  });
  
  const [playlistForm, setPlaylistForm] = useState({
    name: '',
    description: '',
  });
  
  const loadProfileData = useCallback(async () => {
    if (!user) return;
    
    try {
      const [profileRes, favRes, historyRes, playlistRes, ratingRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('watch_history').select('*').eq('user_id', user.id).order('watched_at', { ascending: false }).limit(50),
        supabase.from('playlists').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('ratings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      
      setProfile(profileRes.data);
      setFavorites(favRes.data || []);
      setWatchHistory(historyRes.data || []);
      setPlaylists(playlistRes.data || []);
      setRatings(ratingRes.data || []);
      
      if (profileRes.data) {
        setEditForm({
          username: profileRes.data.username || '',
          full_name: profileRes.data.full_name || '',
          bio: profileRes.data.bio || '',
          avatar_url: profileRes.data.avatar_url || '',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user, loadProfileData]);
  
  async function handleSaveProfile(e) {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: editForm.username,
          full_name: editForm.full_name,
          bio: editForm.bio,
          avatar_url: editForm.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      setProfile(data);
      setShowEditModal(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  }
  
  async function handleCreatePlaylist(e) {
    e.preventDefault();
    if (!playlistForm.name.trim()) return;
    
    try {
      await supabase.from('playlists').insert({
        user_id: user.id,
        name: playlistForm.name.trim(),
        description: playlistForm.description.trim(),
      });
      
      setPlaylistForm({ name: '', description: '' });
      setShowCreatePlaylist(false);
      loadProfileData();
    } catch (error) {
      console.error('Failed to create playlist');
    }
  }
  
  async function handleDeletePlaylist(playlistId) {
    if (!confirm('Delete this playlist and all its items?')) return;
    
    await supabase.from('playlist_items').delete().eq('playlist_id', playlistId);
    await supabase.from('playlists').delete().eq('id', playlistId);
    
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist(null);
      setShowPlaylistItems(false);
    }
  }
  
  async function handleViewPlaylist(playlist) {
    setSelectedPlaylist(playlist);
    setShowPlaylistItems(true);
    
    const { data } = await supabase
      .from('playlist_items')
      .select('*')
      .eq('playlist_id', playlist.id)
      .order('added_at', { ascending: false });
    
    setPlaylistItems(data || []);
  }
  
  async function handleRemoveFromPlaylist(itemId) {
    await supabase.from('playlist_items').delete().eq('id', itemId);
    setPlaylistItems(prev => prev.filter(item => item.id !== itemId));
  }
  
  async function handleRemoveFavorite(favId) {
    await supabase.from('favorites').delete().eq('id', favId);
    setFavorites(prev => prev.filter(f => f.id !== favId));
  }
  
  async function handleClearHistory() {
    if (!confirm('Clear all watch history?')) return;
    await supabase.from('watch_history').delete().eq('user_id', user.id);
    setWatchHistory([]);
  }
  
  if (!user) {
    return (
      <main className={styles.profilePage}>
        <Header />
        <div className={styles.notLoggedIn}>
          <div className={styles.notLoggedInIcon}>🔒</div>
          <h1>Sign In Required</h1>
          <p>Sign in to access your profile.</p>
          <Link href="/auth" className={styles.signInButton}>Sign In</Link>
        </div>
      </main>
    );
  }
  
  if (loading) {
    return (
      <main className={styles.profilePage}>
        <Header />
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </main>
    );
  }
  
  return (
    <main className={styles.profilePage}>
      <Header />
      
      <div className={styles.profileContainer}>
        <div className={styles.coverBanner}></div>
        
        <div className={styles.profileHeader}>
          <div className={styles.avatarSection}>
            <div className={styles.avatar}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username || 'User'} />
              ) : (
                <span>{user.email?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <button className={styles.editProfileButton} onClick={() => setShowEditModal(true)}>
              ✏️ Edit Profile
            </button>
          </div>
          
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>
              {profile?.full_name || profile?.username || user.email?.split('@')[0] || 'User'}
            </h1>
            {profile?.username && <p className={styles.username}>@{profile.username}</p>}
            <p className={styles.profileEmail}>{user.email}</p>
            {profile?.bio && <p className={styles.profileBio}>{profile.bio}</p>}
            
            <div className={styles.profileStats}>
              <div className={styles.stat}>
                <span className={styles.statNumber}>{favorites.length}</span>
                <span className={styles.statLabel}>Favorites</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNumber}>{watchHistory.length}</span>
                <span className={styles.statLabel}>Watched</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNumber}>{ratings.length}</span>
                <span className={styles.statLabel}>Ratings</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNumber}>{playlists.length}</span>
                <span className={styles.statLabel}>Playlists</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Achievements Section */}
        <div className={styles.achievementsSection}>
          <Achievements />
        </div>
        
        <div className={styles.tabsContainer}>
          <div className={styles.tabs}>
            {['overview', 'favorites', 'history', 'playlists', 'ratings'].map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div className={styles.tabContent}>
          {activeTab === 'overview' && (
            <div className={styles.overviewGrid}>
              <div className={styles.overviewSection}>
                <div className={styles.sectionHeader}>
                  <h3>Recent Activity</h3>
                  {watchHistory.length > 0 && (
                    <button className={styles.clearButton} onClick={handleClearHistory}>Clear All</button>
                  )}
                </div>
                {watchHistory.length > 0 ? (
                  watchHistory.slice(0, 10).map(item => (
                    <Link key={item.id} href={`/embed/${item.media_type}/${item.media_id}`} className={styles.activityItem}>
                      {item.poster && <img src={item.poster} alt={item.title} className={styles.activityPoster} />}
                      <div className={styles.activityInfo}>
                        <span className={styles.activityTitle}>{item.title}</span>
                        <span className={styles.activityMeta}>
                          {item.season && `S${item.season} `}
                          {item.episode && `E${item.episode} • `}
                          {new Date(item.watched_at).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className={styles.emptyState}><span>📺</span><p>No watch history yet.</p></div>
                )}
              </div>
              
              <div className={styles.overviewSection}>
                <div className={styles.sectionHeader}>
                  <h3>Your Playlists</h3>
                  <button className={styles.addButton} onClick={() => setShowCreatePlaylist(true)}>+ New</button>
                </div>
                {playlists.length > 0 ? (
                  playlists.slice(0, 5).map(playlist => (
                    <div key={playlist.id} className={styles.playlistItem}>
                      <button className={styles.playlistViewButton} onClick={() => handleViewPlaylist(playlist)}>
                        <div className={styles.playlistIcon}>📝</div>
                        <div className={styles.playlistInfo}>
                          <span className={styles.playlistName}>{playlist.name}</span>
                        </div>
                      </button>
                      <button className={styles.deleteButton} onClick={() => handleDeletePlaylist(playlist.id)}>🗑️</button>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}><span>📝</span><p>No playlists yet.</p></div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'favorites' && (
            <div className={styles.favoritesSection}>
              <h3 className={styles.sectionTitle}>Your Favorites</h3>
              {favorites.length > 0 ? (
                <div className={styles.mediaGrid}>
                  {favorites.map(fav => (
                    <div key={fav.id} className={styles.mediaCard}>
                      <Link href={`/embed/${fav.media_type}/${fav.media_id}`}>
                        {fav.poster ? <img src={fav.poster} alt={fav.title} /> : <div className={styles.noImage}>🎬</div>}
                        <h4>{fav.title}</h4>
                      </Link>
                      <button className={styles.removeButton} onClick={() => handleRemoveFavorite(fav.id)}>✕ Remove</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}><span>❤️</span><p>No favorites yet.</p></div>
              )}
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className={styles.historySection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Watch History</h3>
                {watchHistory.length > 0 && (
                  <button className={styles.clearButton} onClick={handleClearHistory}>Clear All History</button>
                )}
              </div>
              {watchHistory.length > 0 ? (
                <div className={styles.historyList}>
                  {watchHistory.map(item => (
                    <Link key={item.id} href={`/embed/${item.media_type}/${item.media_id}`} className={styles.historyItem}>
                      {item.poster && <img src={item.poster} alt={item.title} />}
                      <div className={styles.historyInfo}>
                        <h4>{item.title}</h4>
                        <p>
                          {item.season && `Season ${item.season} • `}
                          {item.episode && `Episode ${item.episode} • `}
                          {new Date(item.watched_at).toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}><span>🕐</span><p>No watch history yet.</p></div>
              )}
            </div>
          )}
          
          {activeTab === 'playlists' && (
            <div className={styles.playlistsSection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Your Playlists</h3>
                <button className={styles.addButton} onClick={() => setShowCreatePlaylist(true)}>+ Create Playlist</button>
              </div>
              
              {showPlaylistItems && selectedPlaylist ? (
                <div className={styles.playlistItemsView}>
                  <button className={styles.backToPlaylists} onClick={() => setShowPlaylistItems(false)}>
                    ← Back to Playlists
                  </button>
                  <h3>{selectedPlaylist.name}</h3>
                  
                  {playlistItems.length > 0 ? (
                    <div className={styles.playlistItemsGrid}>
                      {playlistItems.map(item => (
                        <div key={item.id} className={styles.playlistItemCard}>
                          <Link href={`/embed/${item.media_type}/${item.media_id}`}>
                            {item.poster ? <img src={item.poster} alt={item.title} /> : <div className={styles.noImage}>🎬</div>}
                            <h4>{item.title}</h4>
                          </Link>
                          <button className={styles.removeFromPlaylist} onClick={() => handleRemoveFromPlaylist(item.id)}>
                            ✕ Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}><span>📝</span><p>This playlist is empty.</p></div>
                  )}
                </div>
              ) : (
                <div className={styles.playlistsGrid}>
                  {playlists.map(playlist => (
                    <div key={playlist.id} className={styles.playlistCard}>
                      <button className={styles.playlistCardView} onClick={() => handleViewPlaylist(playlist)}>
                        <span className={styles.playlistCardIcon}>📝</span>
                        <h4>{playlist.name}</h4>
                      </button>
                      <button className={styles.deleteButton} onClick={() => handleDeletePlaylist(playlist.id)}>🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'ratings' && (
            <div className={styles.ratingsSection}>
              <h3 className={styles.sectionTitle}>Your Ratings</h3>
              {ratings.length > 0 ? (
                <div className={styles.ratingsList}>
                  {ratings.map(rating => (
                    <Link
                      key={rating.id}
                      href={
                        rating.media_type === 'tv' && rating.season !== null
                          ? `/embed/tv/${rating.media_id}?season=${rating.season}&episode=${rating.episode}`
                          : `/embed/${rating.media_type}/${rating.media_id}`
                      }
                      className={styles.ratingItem}
                    >
                      {rating.poster && <img src={rating.poster} alt={rating.title} className={styles.ratingPoster} />}
                      <div className={styles.ratingInfo}>
                        <span className={styles.ratingTitle}>{rating.title || rating.media_id}</span>
                        {rating.media_type === 'tv' && rating.season !== null && (
                          <span className={styles.ratingEpisodeInfo}>Season {rating.season}, Episode {rating.episode}</span>
                        )}
                      </div>
                      <div className={styles.stars}>
                        {'★'.repeat(rating.rating)}
                        {'☆'.repeat(5 - rating.rating)}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}><span>⭐</span><p>No ratings yet.</p></div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Modals */}
      {showEditModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Edit Profile</h2>
              <button className={styles.closeButton} onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProfile} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label>Username</label>
                <input type="text" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} placeholder="Your username" />
              </div>
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input type="text" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} placeholder="Your full name" />
              </div>
              <div className={styles.formGroup}>
                <label>Bio</label>
                <textarea value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} placeholder="Tell us about yourself" rows={3} />
              </div>
              <div className={styles.formGroup}>
                <label>Avatar URL</label>
                <input type="url" value={editForm.avatar_url} onChange={e => setEditForm({...editForm, avatar_url: e.target.value})} placeholder="https://example.com/avatar.jpg" />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className={styles.saveButton}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {showCreatePlaylist && (
        <div className={styles.modalOverlay} onClick={() => setShowCreatePlaylist(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create Playlist</h2>
              <button className={styles.closeButton} onClick={() => setShowCreatePlaylist(false)}>✕</button>
            </div>
            <form onSubmit={handleCreatePlaylist} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label>Playlist Name</label>
                <input type="text" value={playlistForm.name} onChange={e => setPlaylistForm({...playlistForm, name: e.target.value})} placeholder="My Awesome Playlist" required />
              </div>
              <div className={styles.formGroup}>
                <label>Description</label>
                <textarea value={playlistForm.description} onChange={e => setPlaylistForm({...playlistForm, description: e.target.value})} placeholder="What's this playlist about?" rows={3} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowCreatePlaylist(false)}>Cancel</button>
                <button type="submit" className={styles.saveButton}>Create Playlist</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}