import React, { useState, useEffect, useRef } from 'react';
import { diaryAudio } from '../utils/audio';

// Renders text as handwriting that "bleeds" into the parchment one
// character at a time. `text` may grow over time (streamed replies): the
// reveal simply chases the growing target without restarting. Pass a new
// `resetKey` to begin a fresh reveal.
export default function TomRiddleWriter({ text, resetKey = 0, onComplete }) {
  const [displayedChars, setDisplayedChars] = useState(0);
  const textRef = useRef(text || '');
  const completeRef = useRef(false);

  useEffect(() => {
    textRef.current = text || '';
  }, [text]);

  useEffect(() => {
    setDisplayedChars(0);
    completeRef.current = false;
    if (textRef.current) {
      diaryAudio.playInkResurface();
    }

    const interval = setInterval(() => {
      setDisplayedChars(prev => {
        const target = textRef.current.length;
        if (prev >= target) {
          if (!completeRef.current && target > 0) {
            completeRef.current = true;
            if (onComplete) onComplete();
          }
          return prev;
        }
        // Speed up when a large streamed chunk is waiting to be revealed.
        const step = target - prev > 150 ? 3 : 1;
        if (prev % 3 === 0) {
          diaryAudio.playPenScratch();
        }
        return prev + step;
      });
    }, 45); // Speed of ink bleeding

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

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
