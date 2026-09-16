import React, { useState, useEffect } from 'react';
import BookCover from './components/BookCover';
import ParchmentSpread from './components/ParchmentSpread';
import LoginPage from './components/LoginPage';
import { diaryAudio } from './utils/audio';

const API_BASE = '/api';

// Fetch helper with a hard timeout so a hung request can never leave the UI
// stuck in a loading state. Falls back to plain fetch on older browsers.
const fetchWithTimeout = (url, opts = {}, ms = 25000) => {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
  }
  return fetch(url, opts);
};

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [memories, setMemories] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [personaName, setPersonaName] = useState('Tom');

  // Declared here so the handlers below reference it in source order
  // (it was previously declared after them, which worked only because
  // handlers run post-render).
  const currentUsername = user ? user.username : 'anonymous';

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('inkbound_user') || 'null');
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const storedPersona = localStorage.getItem(`inkbound_persona_${user.username}`);
      setPersonaName(storedPersona || 'Tom');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchEntries();
      fetchMemories();
    }
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsOpen(true);
    diaryAudio.playPageFlip();
    diaryAudio.startAmbient();
  };

  const handleLogout = () => {
    localStorage.removeItem('inkbound_user');
    setUser(null);
    setIsOpen(false);
    setShowSettings(false);
    setPersonaName('Tom');
  };

  const handleSavePersona = (name) => {
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem(`inkbound_persona_${currentUsername}`, trimmed);
      setPersonaName(trimmed);
    }
  };

  const handleClearMemory = async () => {
    try {
      await fetchWithTimeout(`${API_BASE}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername })
      });
      setEntries([]);
      setMemories([]);
      setShowSettings(false);
      diaryAudio.playInkSink();
    } catch (err) {
      console.warn('Reset error:', err);
      setEntries([]);
      setMemories([]);
      setShowSettings(false);
    }
  };

  const fetchEntries = async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/entries?username=${encodeURIComponent(currentUsername)}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.warn("Backend offline, running in local diary mode:", err);
    }
  };

  const fetchMemories = async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/memories?username=${encodeURIComponent(currentUsername)}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.warn("Backend offline, memory bank offline:", err);
    }
  };

  // Optimistic per-memory operations — the UI updates instantly, then the
  // list is re-fetched so it always settles to the server's truth.
  const handleDeleteMemory = async (id) => {
    setMemories(prev => prev.filter(m => m.id !== id));
    try {
      await fetchWithTimeout(`${API_BASE}/memories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, username: currentUsername })
      });
    } catch (err) {
      console.warn('Delete memory failed:', err);
    }
    fetchMemories();
  };

  const handleUpdateMemory = async (id, value) => {
    setMemories(prev => prev.map(m => (m.id === id ? { ...m, value } : m)));
    try {
      await fetchWithTimeout(`${API_BASE}/memories`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, username: currentUsername, value })
      });
    } catch (err) {
      console.warn('Update memory failed:', err);
    }
    fetchMemories();
  };

  const handleDeleteEntry = async (id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    try {
      await fetchWithTimeout(`${API_BASE}/entries`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, username: currentUsername })
      });
    } catch (err) {
      console.warn('Delete entry failed:', err);
    }
    fetchEntries();
  };

  const handleOpenBook = () => {
    setIsOpen(true);
    diaryAudio.playPageFlip();
    diaryAudio.startAmbient();
  };

  // Reads the NDJSON stream produced by /api/interact:
  //   {"t":"chunk","v":"..."}  reply text deltas, in order
  //   {"t":"done", ...}        final payload, returned as the result
  // Falls back to plain-JSON parsing for servers that do not stream.
  const readInteractionStream = async (res, onChunk) => {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('ndjson') || !res.body) {
      return res.json();
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let final = null;

    const handleLine = (line) => {
      if (!line) return;
      try {
        const evt = JSON.parse(line);
        if (evt.t === 'chunk' && typeof evt.v === 'string') {
          onChunk(evt.v);
        } else if (evt.t === 'done') {
          final = evt;
        }
      } catch { /* ignore malformed line */ }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        handleLine(buffer.slice(0, nl).trim());
        buffer = buffer.slice(nl + 1);
      }
    }
    if (buffer.trim()) handleLine(buffer.trim());

    return final || { should_reply: true, response_text: '', extracted_memories: [] };
  };

  const handleInteract = async (userContent, onChunk = () => {}) => {
    setIsLoading(true);
    try {
      const res = await fetchWithTimeout(`${API_BASE}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userContent, personaName, username: currentUsername })
      }, 40000);

      if (res.ok) {
        const data = await readInteractionStream(res, onChunk);
        fetchEntries();
        fetchMemories();
        setIsLoading(false);
        return data;
      }
    } catch (err) {
      console.warn("API interact failed, fallback local response used:", err);
    }

    setIsLoading(false);
    const fallbackReply = `I hear your words. The ink fades, but the memory remains. What else do you wish to reveal to me?`;
    const localEntry = { id: Date.now(), content: userContent, response: fallbackReply };
    setEntries(prev => [...prev, localEntry]);
    return { should_reply: true, response_text: fallbackReply, extracted_memories: [] };
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="book-wrapper">
      <div className="book-container">
        {!isOpen ? (
          <BookCover onOpen={handleOpenBook} username={user?.username} />
        ) : (
          <ParchmentSpread
            entries={entries}
            memories={memories}
            username={currentUsername}
            onInteract={handleInteract}
            onDeleteEntry={handleDeleteEntry}
            onDeleteMemory={handleDeleteMemory}
            onUpdateMemory={handleUpdateMemory}
            personaName={personaName}
            isLoading={isLoading}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
          />
        )}
      </div>

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2 className="settings-title">Settings</h2>
              <button className="btn-icon" onClick={() => setShowSettings(false)}>
                ×
              </button>
            </div>

             <div className="settings-section">
               <label className="settings-label">User</label>
               <p style={{ fontSize: '0.85rem', color: '#b8860b', fontStyle: 'normal', marginBottom: '4px' }}>
                 {currentUsername}
               </p>
             </div>

             <div className="settings-section">
               <label className="settings-label">Persona Name</label>
              <input
                type="text"
                className="form-input"
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                placeholder="Enter persona name"
              />
              <button className="btn-quill" style={{ marginTop: '8px' }} onClick={() => handleSavePersona(personaName)}>
                Save
              </button>
            </div>

            <div className="settings-section">
              <label className="settings-label">Diary Memory</label>
              <p style={{ fontSize: '0.85rem', color: '#8c7355', fontStyle: 'italic', marginBottom: '8px' }}>
                This will clear all entries and memories. This cannot be undone.
              </p>
              <button className="btn-icon" style={{ color: '#7c0a0a', borderColor: 'rgba(124,10,10,0.4)' }} onClick={handleClearMemory}>
                Clear Memory
              </button>
            </div>

            <div className="settings-section">
              <button className="btn-icon" style={{ color: '#8c7355' }} onClick={handleLogout}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}