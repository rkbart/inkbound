import React from 'react';
import { Sparkles } from 'lucide-react';

export default function BookCover({ onOpen }) {
  return (
    <div className="book-cover-closed" onClick={onOpen}>
      <div className="leather-texture" />
      
      {/* Corner Brackets */}
      <div className="corner-plate corner-tl" />
      <div className="corner-plate corner-tr" />
      <div className="corner-plate corner-bl" />
      <div className="corner-plate corner-br" />

      {/* Title */}
      <div>
        <h1 className="embossed-title">INKBOUND</h1>
        <p className="embossed-subtitle">Living Journal</p>
      </div>

      {/* Center Crest */}
      <div style={{
        width: '100px',
        height: '100px',
        border: '2px solid #b8860b',
        borderRadius: '50%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15), transparent)',
        boxShadow: '0 0 15px rgba(212, 175, 55, 0.2)'
      }}>
        <Sparkles size={36} color="#d4af37" />
      </div>

      {/* Prompt */}
      <p style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '0.9rem',
        fontStyle: 'italic',
        color: '#a88d52',
        letterSpacing: '1px',
        textAlign: 'center'
      }}>
        Click cover to open
      </p>
    </div>
  );
}
