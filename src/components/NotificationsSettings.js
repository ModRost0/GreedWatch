// src/components/NotificationSettings.jsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function NotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    replies: true,
    likes: true,
    newEpisodes: true,
    recommendations: false,
  });
  
  function toggleSetting(key) {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }
  
  return (
    <div className="notificationSettings">
      <h3>Notification Settings</h3>
      {Object.entries(settings).map(([key, value]) => (
        <div key={key} className="settingRow">
          <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
          <button 
            className={`toggleSwitch ${value ? 'on' : 'off'}`}
            onClick={() => toggleSetting(key)}
          >
            <span className="toggleKnob"></span>
          </button>
        </div>
      ))}
    </div>
  );
}