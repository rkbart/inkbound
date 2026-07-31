import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!isLogin && !password.trim()) {
      setError('Please enter a password');
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
          <p className="login-subtitle">{isLogin ? 'Sign in to your diary' : 'Create a new identity'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              autoFocus
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
              />
            </div>
          )}

          {error && <span className="form-error">{error}</span>}

          <button type="submit" className="btn-quill" style={{ width: '100%', justifyContent: 'center' }}>
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="login-toggle">
          <span className="login-toggle-text">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button className="login-toggle-btn" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}