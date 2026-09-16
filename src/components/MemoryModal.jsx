import React, { useState } from 'react';
import { X, Brain, Trash2, Pencil, Check } from 'lucide-react';

// "What the Diary Knows" — the memory bank extracted from the user's
// entries. Each memory can be rewritten (fix a misheard name) or obliviated
// (deleted) individually; operations are handled by App via onUpdate/onDelete.
export default function MemoryModal({ memories, username, onClose, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (mem) => {
    setEditingId(mem.id);
    setEditValue(mem.value);
  };

  const saveEdit = async (id) => {
    const value = editValue.trim();
    if (value && value !== memories.find(m => m.id === id)?.value) {
      await onUpdate(id, value);
    }
    setEditingId(null);
  };

  return (
    <div className="memory-modal-overlay" onClick={onClose}>
      <div className="memory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="memory-modal-header">
          <div className="memory-modal-title">
            <Brain size={22} />
            <h2>What the Diary Knows</h2>
          </div>
          <button onClick={onClose} className="btn-icon" title="Close">
            <X size={18} />
          </button>
        </div>

        <p className="memory-modal-subtitle">
          {username
            ? `Truths, names, and secrets absorbed from ${username}'s writing:`
            : 'Truths, names, and secrets absorbed from your writing:'}
        </p>

        <div className="memory-modal-list">
          {memories.length === 0 ? (
            <p className="memory-modal-empty">
              No memories absorbed yet. Write on the parchment to begin...
            </p>
          ) : (
            memories.map((mem) => (
              <div key={mem.id || mem.key} className="memory-row">
                <div className="memory-row-main">
                  <span className="memory-row-category">[{mem.category}]</span>
                  <span className="memory-row-key">{mem.key}</span>
                  {editingId === mem.id ? (
                    <input
                      className="memory-edit-input"
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(mem.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => saveEdit(mem.id)}
                    />
                  ) : (
                    <span className="memory-row-value">{mem.value}</span>
                  )}
                </div>
                <div className="memory-row-actions">
                  {editingId === mem.id ? (
                    <button
                      className="btn-icon"
                      title="Save"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => saveEdit(mem.id)}
                    >
                      <Check size={13} />
                    </button>
                  ) : (
                    <button className="btn-icon" title="Rewrite this memory" onClick={() => startEdit(mem)}>
                      <Pencil size={13} />
                    </button>
                  )}
                  <button
                    className="btn-icon memory-delete"
                    title="Obliviate this memory"
                    onClick={() => onDelete(mem.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="memory-modal-footer">
          <span className="memory-modal-hint">These memories shape every reply the diary writes.</span>
          <button onClick={onClose} className="btn-quill">
            Return to Diary
          </button>
        </div>
      </div>
    </div>
  );
}
