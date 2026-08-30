// src/components/ResumePrompt.jsx
'use client';

import { useState, useEffect } from 'react';

export default function ResumePrompt({ position, duration, onResume, onRestart }) {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    if (position > 0) {
      setVisible(true);
    }
  }, [position]);
  
  if (!visible) return null;
  
  const minutes = Math.floor(position / 60);
  const seconds = Math.floor(position % 60);
  const progressPercent = duration > 0 ? Math.min((position / duration) * 100, 100) : 0;
  
  return (
    <div className="resumePrompt">
      <div className="resumePromptContent">
        <div className="resumeIcon">▶</div>
        <div className="resumeInfo">
          <h4>Resume watching?</h4>
          <p>You left off at {minutes}:{seconds.toString().padStart(2, '0')}</p>
          <div className="resumeProgressBar">
            <div className="resumeProgressFill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
        <div className="resumeActions">
          <button className="resumeButton" onClick={onResume}>
            Resume
          </button>
          <button className="restartButton" onClick={onRestart}>
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}