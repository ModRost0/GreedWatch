// src/components/AutoNext.jsx
'use client';

import { useState, useEffect } from 'react';

export default function AutoNext({ onNext, nextEpisode, isTVShow }) {
  const [countdown, setCountdown] = useState(5);
  const [isActive, setIsActive] = useState(false);
  
  useEffect(() => {
    if (!isActive || !isTVShow) return;
    
    if (countdown === 0) {
      onNext();
      setIsActive(false);
      setCountdown(5);
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, isActive, onNext, isTVShow]);
  
  if (!isTVShow || !nextEpisode) return null;
  
  return (
    <div className="autoNextContainer">
      {!isActive ? (
        <button className="autoNextButton" onClick={() => setIsActive(true)}>
          ▶ Auto-play next episode
        </button>
      ) : (
        <div className="countdownDisplay">
          <span>Next episode in {countdown}s</span>
          <button onClick={() => { setIsActive(false); setCountdown(5); }}>Cancel</button>
        </div>
      )}
    </div>
  );
}