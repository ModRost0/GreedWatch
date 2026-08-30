// src/components/QuickReactions.jsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const REACTIONS = ['😍', '😂', '😱', '😭', '🔥', '👏'];

export default function QuickReactions({ mediaId, episodeId }) {
  const { user } = useAuth();
  const [selectedReaction, setSelectedReaction] = useState(null);
  const [showReactions, setShowReactions] = useState(false);
  
  function handleReaction(emoji) {
    if (!user) {
      alert('Sign in to react');
      return;
    }
    setSelectedReaction(emoji);
    setShowReactions(false);
  }
  
  return (
    <div className="quickReactions">
      <button 
        className="reactionTrigger"
        onClick={() => setShowReactions(!showReactions)}
      >
        {selectedReaction || '😀'} React
      </button>
      
      {showReactions && (
        <div className="reactionPicker">
          {REACTIONS.map(emoji => (
            <button key={emoji} onClick={() => handleReaction(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}