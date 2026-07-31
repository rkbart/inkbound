import React from 'react';
import { X, Brain, Trash2 } from 'lucide-react';

export default function MemoryModal({ memories, onClose, onReset }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 8, 12, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        background: 'linear-gradient(135deg, #1e1610 0%, #110b07 100%)',
        border: '2px solid #b8860b',
        borderRadius: '12px',
        padding: '28px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.9), 0 0 2parchm0px rgba(212,175,55,0.2)',
        color: '#f4ebd9',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(184,134,11,0.3)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain color="#d4af37" size={24} />
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', color: '#d4af37' }}>
              Memories Sunk into the Fiber
            </h2>
          </div>
          <button onClick={onClose} className="btn-icon" title="Close Drawer">
            <X size={20} />
          </button>
        </div>

        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', color: '#a88d52', marginBottom: '16px', fontStyle: 'italic' }}>
          These are the truths, names, and secrets the diary has absorbed from your writing:
        </p>

        {/* Memories List */}
        <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '6px' }}>
          {memories.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#8c7355', padding: '30px 0', fontStyle: 'italic' }}>
              No memories absorbed yet. Write on the parchment to begin...
            </p>
          ) : (
            memories.map((mem) => (
              <div key={mem.id || mem.key} className="memory-badge">
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#b8860b', letterSpacing: '1px' }}>
                    [{mem.category}]
                  </span>
                  <div className="memory-key">{mem.key}</div>
                </div>
                <div className="memory-val">{mem.value}</div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed rgba(184,134,11,0.2)' }}>
          <button
            onClick={onReset}
            style={{
              background: 'rgba(139, 0, 0, 0.2)',
              border: '1px solid #8b0000',
              color: '#ff6b6b',
              padding: '8px 14px',
              borderRadius: '6px',
              fontFamily: 'var(--font-serif)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Trash2 size={16} /> Obliviate (Clear Memory)
          </button>
          
          <button onClick={onClose} className="btn-quill" style={{ padding: '8px 18px' }}>
            Return to Diary
          </button>
        </div>
      </div>
    </div>
  );
}
