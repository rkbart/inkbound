import React, { useState, useEffect } from 'react';
import BookCover from './components/BookCover';
import ParchmentSpread from './components/ParchmentSpread';
import LoginPage from './components/LoginPage';
import { diaryAudio } from './utils/audio';

const API_BASE = '/api';

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [memories, setMemories] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [personaName, setPersonaName] = useState('Tom Riddle');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('inkbound_user') || 'null');
    if (storedUser) {
      setUser(storedUser);
      const storedPersona = localStorage.getItem(`inkbound_persona_${storedUser.username}`);
      if (storedPersona) {
        setPersonaName(storedPersona);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchEntries();
      fetchMemories();
    }
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsOpen(true);
    const storedPersona = localStorage.getItem(`inkbound_persona_${userData.username}`);
    if (storedPersona) {
      setPersonaName(storedPersona);
    } else {
      setPersonaName('Tom Riddle');
    }
    diaryAudio.playPageFlip();
    diaryAudio.startAmbient();
  };

  const handleLogout = () => {
    localStorage.removeItem('inkbound_user');
    setUser(null);
    setIsOpen(false);
    setShowSettings(false);
    setPersonaName('Tom Riddle');
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
      await fetch(`${API_BASE}/reset`, {
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

  const currentUsername = user ? user.username : 'anonymous';

  const fetchEntries = async () => {
    try {
      const res = await fetch(`${API_BASE}/entries?username=${encodeURIComponent(currentUsername)}`);
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
      const res = await fetch(`${API_BASE}/memories?username=${encodeURIComponent(currentUsername)}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.warn("Backend offline, memory bank offline:", err);
    }
  };

  const handleOpenBook = () => {
    setIsOpen(true);
    diaryAudio.playPageFlip();
    diaryAudio.startAmbient();
  };

  const handleInteract = async (userContent) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userContent, personaName, username: currentUsername })
      });

      if (res.ok) {
        const data = await res.json();
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
    return { should_reply: true, response_text: fallbackReply };
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="book-wrapper">
      <div className="book-container">
        {!isOpen ? (
          <BookCover onOpen={handleOpenBook} />
        ) : (
          <ParchmentSpread
            entries={entries}
            onInteract={handleInteract}
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