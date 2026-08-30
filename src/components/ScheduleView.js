// src/components/ScheduleView.jsx - Fixed hydration
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export default function ScheduleView({ schedule }) {
  const [activeDay, setActiveDay] = useState(0);
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const groupedByDay = useMemo(() => {
    const grouped = Array.from({ length: 7 }, () => []);
    
    (schedule || []).forEach(item => {
      const date = new Date(item.airingAt * 1000);
      const dayIndex = date.getDay();
      
      // Use consistent time format (24-hour to avoid AM/PM mismatch)
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      
      grouped[dayIndex].push({
        ...item,
        time,
      });
    });
    
    grouped.forEach(dayItems => {
      dayItems.sort((a, b) => a.airingAt - b.airingAt);
    });
    
    return grouped;
  }, [schedule]);
  
  if (!schedule || schedule.length === 0) {
    return <p className="empty">No schedule available.</p>;
  }
  
  return (
    <div>
      <div className="scheduleTabs">
        {days.map((day, index) => (
          <button
            key={day}
            className={`scheduleTab ${activeDay === index ? 'active' : ''}`}
            onClick={() => setActiveDay(index)}
          >
            {day}
          </button>
        ))}
      </div>
      
      <div className="scheduleContainer">
        {groupedByDay[activeDay].length > 0 ? (
          groupedByDay[activeDay].map(item => (
            <Link
              key={item.id}
              href={`/anime/${item.mediaId}`}
              className="scheduleCard"
            >
              <div className="scheduleCardTop">
                {item.image && (
                  <img 
                    src={item.image} 
                    alt={item.title} 
                    className="scheduleCardImage"
                    loading="lazy"
                  />
                )}
                <div className="scheduleCardInfo">
                  <div className="scheduleCardTitle">{item.title}</div>
                  <div className="scheduleCardEpisode">Ep {item.episode}</div>
                </div>
              </div>
              <div className="scheduleCardBottom">
                <span className="scheduleCardTime">⏰ {item.time}</span>
                {item.format && (
                  <span className="scheduleCardFormat">{item.format}</span>
                )}
              </div>
            </Link>
          ))
        ) : (
          <p className="empty">No anime scheduled for {days[activeDay]}.</p>
        )}
      </div>
    </div>
  );
}