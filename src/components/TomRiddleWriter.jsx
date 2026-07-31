import React, { useState, useEffect } from 'react';
import { diaryAudio } from '../utils/audio';

export default function TomRiddleWriter({ text, onComplete }) {
  const [displayedChars, setDisplayedChars] = useState(0);

  useEffect(() => {
    if (!text) return;
    setDisplayedChars(0);
    diaryAudio.playInkResurface();

    const interval = setInterval(() => {
      setDisplayedChars(prev => {
        if (prev < text.length) {
          // Play subtle scratch every 3 characters for realistic writing sound
          if (prev % 3 === 0) {
            diaryAudio.playPenScratch();
          }
          return prev + 1;
        } else {
          clearInterval(interval);
          if (onComplete) onComplete();
          return prev;
        }
      });
    }, 45); // Speed of ink bleeding

    return () => clearInterval(interval);
  }, [text, onComplete]);

  if (!text) return null;

  const characters = text.split('');

  return (
    <div className="riddle-ink-text">
      {characters.slice(0, displayedChars).map((char, index) => (
        <span
          key={index}
          className="ink-bleed-char"
          style={{ animationDelay: `${(index % 10) * 0.02}s` }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
