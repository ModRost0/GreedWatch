// src/components/Header.jsx
'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const auth = useAuth();
  const { user, signOut } = auth || { user: null, signOut: () => {} };
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef(null);
  const notifRef = useRef(null);
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);
  
  async function loadNotifications() {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (error) {}
  }
  
  async function markAsRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    loadNotifications();
  }
  
  return (
    <header className="nav">
      <Link className="wordmark" href="/">Greed<span>.</span></Link>
      
      <nav className="navLinks">
        <Link href="/discover">Discover</Link>
        <Link href="/popular">Popular</Link>
        <Link href="/upcoming">Upcoming</Link>
        <Link href="/anime" className="animeNavLink">🎌 Anime</Link>
      </nav>
      
      <div className="navRight">
        <Link className="navSearch" href="/search">⌕ <span>Search</span></Link>
        
        {user && (
          <div className="notificationContainer" ref={notifRef}>
            <button className="notificationButton" onClick={() => setShowNotifications(!showNotifications)}>
              🔔
              {unreadCount > 0 && <span className="notificationBadge">{unreadCount}</span>}
            </button>
            
            {showNotifications && (
              <div className="notificationDropdown">
                <h4>Notifications</h4>
                {notifications.length > 0 ? (
                  notifications.map(notif => (
                    <Link 
                      key={notif.id} 
                      href={notif.link || '#'}
                      className={`notificationItem ${!notif.is_read ? 'unread' : ''}`}
                      onClick={() => {
                        markAsRead(notif.id);
                        setShowNotifications(false);
                      }}
                    >
                      <p>{notif.content}</p>
                      <span>{new Date(notif.created_at).toLocaleDateString()}</span>
                    </Link>
                  ))
                ) : (
                  <p className="noNotifications">No notifications</p>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="profileContainer" ref={menuRef}>
          <button className="profileButton" onClick={() => setShowMenu(!showMenu)}>
            {user ? (
              <span className="profileAvatar">{user.email?.[0]?.toUpperCase() || 'U'}</span>
            ) : (
              <span className="profileIcon">👤</span>
            )}
          </button>
          
          {showMenu && (
            <div className="profileDropdown">
              {user ? (
                <>
                  <div className="profileHeader">
                    <div className="profileAvatarLarge">{user.email?.[0]?.toUpperCase() || 'U'}</div>
                    <div className="profileUserInfo">
                      <span className="profileName">{user.email?.split('@')[0] || 'User'}</span>
                      <span className="profileEmail">{user.email}</span>
                    </div>
                  </div>
                  <div className="dropdownDivider"></div>
                  <Link href="/profile" className="dropdownItem" onClick={() => setShowMenu(false)}>
                    <span className="dropdownIcon">👤</span> My Profile
                  </Link>
                  <div className="dropdownDivider"></div>
                  <button className="dropdownItem signOutItem" onClick={() => { signOut(); setShowMenu(false); window.location.href = '/'; }}>
                    <span className="dropdownIcon">🚪</span> Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth" className="dropdownItem" onClick={() => setShowMenu(false)}>
                    <span className="dropdownIcon">🔑</span> Sign In
                  </Link>
                  <Link href="/auth?signup=true" className="dropdownItem" onClick={() => setShowMenu(false)}>
                    <span className="dropdownIcon">✨</span> Create Account
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}