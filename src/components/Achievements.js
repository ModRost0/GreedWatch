// src/components/Achievements.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Achievements() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [streak, setStreak] = useState(0);
  
  useEffect(() => {
    if (user) {
      loadAchievements();
      calculateStreak();
    }
  }, [user]);
  
  async function loadAchievements() {
    try {
      const { data } = await supabase
        .from('watch_history')
        .select('watched_at, media_id, episode')
        .eq('user_id', user.id);
      
      if (data) {
        const totalWatched = data.length;
        const uniqueShows = new Set(data.map(d => d.media_id)).size;
        const totalEpisodes = data.filter(d => d.episode !== null).length;
        
        const achievementsList = [
          { id: 'first', name: 'First Watch', emoji: '🎬', earned: totalWatched >= 1, desc: 'Watch your first title' },
          { id: 'binge5', name: 'Binge Watcher', emoji: '📺', earned: totalWatched >= 5, desc: 'Watch 5 titles' },
          { id: 'binge20', name: 'Marathon Runner', emoji: '🏃', earned: totalEpisodes >= 20, desc: 'Watch 20 episodes' },
          { id: 'explorer', name: 'Explorer', emoji: '🧭', earned: uniqueShows >= 10, desc: 'Watch 10 different titles' },
          { id: 'critic', name: 'Critic', emoji: '⭐', earned: totalWatched >= 15, desc: 'Watch 15 titles' },
        ];
        
        setAchievements(achievementsList);
      }
    } catch (error) {
      console.warn('Achievements not available');
    }
  }
  
  async function calculateStreak() {
    try {
      const { data } = await supabase
        .from('watch_history')
        .select('watched_at')
        .eq('user_id', user.id)
        .order('watched_at', { ascending: false });
      
      if (data && data.length > 0) {
        let streakCount = 0;
        const dates = new Set(data.map(d => new Date(d.watched_at).toDateString()));
        
        let checkDate = new Date();
        if (!dates.has(checkDate.toDateString())) {
          checkDate.setDate(checkDate.getDate() - 1);
        }
        
        while (dates.has(checkDate.toDateString())) {
          streakCount++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
        
        setStreak(streakCount);
      }
    } catch (error) {
      console.warn('Streak not available');
    }
  }
  
  if (!user) return null;
  
  if (achievements.length === 0 && streak === 0) return null;
  
  return (
    <div className="achievementsContainer">
      {streak > 0 && (
        <div className="streakDisplay">
          <span className="streakEmoji">🔥</span>
          <div>
            <span className="streakNumber">{streak} Day Streak!</span>
            {streak > 0 && <span className="streakMessage">Keep it up!</span>}
          </div>
        </div>
      )}
      
      {achievements.length > 0 && (
        <div className="achievementsGrid">
          {achievements.map(ach => (
            <div key={ach.id} className={`achievementCard ${ach.earned ? 'earned' : 'locked'}`}>
              <span className="achievementEmoji">{ach.emoji}</span>
              <span className="achievementName">{ach.name}</span>
              <span className="achievementDesc">{ach.desc}</span>
              {ach.earned ? <span className="checkmark">✓</span> : <span className="lock">🔒</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}