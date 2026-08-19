import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter your name');
      return;
    }

    const user = {
      username: username.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      localStorage.setItem('inkbound_user', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError('Failed to save session. Please try again.');
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('inkbound_user');
    window.location.reload();
  };

  const storedUser = JSON.parse(localStorage.getItem('inkbound_user') || 'null');

  if (storedUser) {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <div className="login-header">
            <Sparkles size={32} color="#d4af37" />
            <h1 className="login-title">Inkbound Diary</h1>
            <p className="login-subtitle">Welcome back, {storedUser.username}</p>
          </div>
          <div className="login-actions">
            <button className="btn-quill" onClick={() => onLogin(storedUser)}>
              Continue to Diary
            </button>
            <button className="btn-icon" onClick={handleLogout} style={{ marginTop: '12px', color: '#8c7355' }}>
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-header">
          <Sparkles size={32} color="#d4af37" />
          <h1 className="login-title">Inkbound Diary</h1>
          <p className="login-subtitle">Enter your name to begin</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Type your name"
              autoFocus
            />
          </div>

          {error && <span className="form-error">{error}</span>}

          <button type="submit" className="btn-quill" style={{ width: '100%', justifyContent: 'center' }}>
            Enter Diary
          </button>
        </form>
      </div>
    </div>
  );
}
