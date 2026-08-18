import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Sparkles, Settings, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import TomRiddleWriter from './TomRiddleWriter';
import { diaryAudio } from '../utils/audio';

export default function ParchmentSpread({
  entries,
  onInteract,
  personaName,
  isLoading,
  showSettings,
  setShowSettings
}) {
  const [inputText, setInputText] = useState('');
  const [isSinking, setIsSinking] = useState(false);
  const [activeReply, setActiveReply] = useState(null);
  const [silentMessage, setSilentMessage] = useState(null);
  const [viewState, setViewState] = useState('write');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showEntries, setShowEntries] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [responseViewIndex, setResponseViewIndex] = useState(-1);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const entriesPerPage = 3;
  const textareaRef = useRef(null);

  const totalPages = Math.max(1, Math.ceil(entries.length / entriesPerPage));
  const currentEntries = entries.slice(currentPage * entriesPerPage, (currentPage + 1) * entriesPerPage);
  const pageStart = currentPage * entriesPerPage + 1;
  const pageEnd = Math.min((currentPage + 1) * entriesPerPage, entries.length);

  useEffect(() => {
    if (entries.length > 0) {
      setCurrentPage(Math.max(0, Math.ceil(entries.length / entriesPerPage) - 1));
    }
  }, [entries.length]);

  const goNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  const goPrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const goNewerResponse = () => {
    if (responseViewIndex >= 0) {
      if (responseViewIndex < entries.length - 1) {
        setResponseViewIndex(responseViewIndex + 1);
      } else {
        setResponseViewIndex(-1);
      }
    }
  };

  const hasNewerResponses = responseViewIndex >= 0;

  const currentDateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handleTextChange = (e) => {
    setInputText(e.target.value);
    diaryAudio.playPenScratch();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSinkIntoPaper();
    }
  };

  const handleSinkIntoPaper = async () => {
    if (!inputText.trim() || isSinking || isLoading) return;

    setIsSinking(true);
    setViewState('sinking');
    setSilentMessage(null);
    setActiveReply(null);
    diaryAudio.playInkSink();

    const currentMessage = inputText.trim();

    setTimeout(async () => {
      setInputText('');
      setIsSinking(false);
      setViewState('response');
      setShowSkeleton(true);

      const loadStart = Date.now();
      const result = await onInteract(currentMessage);
      const elapsed = Date.now() - loadStart;
      const remaining = Math.max(0, 800 - elapsed);
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));

      setShowSkeleton(false);

      if (result && result.should_reply && result.response_text) {
        setActiveReply(result.response_text);
      } else {
        setSilentMessage("The ink sinks quietly into the parchment... The diary remains still.");
      }
    }, 1800);
  };

  const handleWriteNextEntry = () => {
    setActiveReply(null);
    setSilentMessage(null);
    setResponseViewIndex(-1);
    setViewState('write');
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.focus();
    }, 100);
  };

  const toggleAudio = () => {
    const newState = diaryAudio.toggleAudio();
    setAudioEnabled(newState);
    if (newState) {
      diaryAudio.startAmbient();
    } else {
      diaryAudio.stopAmbient();
    }
  };

  useEffect(() => {
    if (activeReply || silentMessage) setResponseViewIndex(-1);
  }, [activeReply, silentMessage]);

  return (
    <div className="parchment-spread">
      <div className="spine-fold" />

      <div className="page-left">
        <div className="page-header">
          <span className="date-stamp">Parchment Memory ({entries.length})</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn-icon" onClick={() => setShowEntries(!showEntries)} title={showEntries ? 'Hide Memory' : 'Show Memory'}>
              {showEntries ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button className={`btn-icon ${audioEnabled ? 'active' : ''}`} onClick={toggleAudio} title="Toggle Ambient Audio">
              {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button className="btn-icon" onClick={() => setShowSettings(true)} title="Settings">
              <Settings size={18} />
            </button>
          </div>
        </div>

        {showEntries && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {showSkeleton ? (
              <div style={{ flex: 1, overflow: 'hidden', padding: '4px 0' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton-entry">
                    <div className="skeleton-line user" />
                    <div className="skeleton-line diary" />
                    <div className="skeleton-line date" />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8c7355', marginTop: '60px', fontStyle: 'italic' }}>
                <Sparkles size={28} color="#b8860b" style={{ marginBottom: '12px' }} />
                <p>The pages are blank.</p>
                <p style={{ fontSize: '0.9rem', marginTop: '6px' }}>
                  Write your first entry on the right page to awaken the diary...
                </p>
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {currentEntries.map((entry, idx) => (
                  <div key={entry.id || idx} className="history-entry-item">
                    <div className="history-user-text">"{entry.content}"</div>
                    {entry.response ? (
                      <div className="history-riddle-text">
                        <span style={{ fontSize: '0.9rem', color: '#b8860b', fontStyle: 'normal' }}>The Diary: </span>
                        {entry.response}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: '#8c7355', fontStyle: 'italic', marginTop: '4px' }}>
                        *Ink absorbed in silence*
                      </div>
                    )}
                    {entry.created_at && (
                      <div className="history-entry-date">
                        {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', paddingTop: '4px', borderTop: '1px dashed rgba(139,107,27,0.3)' }}>
                {currentPage > 0 ? (
                  <button className="btn-icon" onClick={goPrevPage} title="Previous page">
                    <ChevronLeft size={16} />
                  </button>
                ) : <div style={{ width: 28 }} />}
                <span style={{ fontSize: '0.8rem', color: '#8c7355', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                  {pageStart}–{pageEnd} of {entries.length}
                </span>
                {currentPage < totalPages - 1 ? (
                  <button className="btn-icon" onClick={goNextPage} title="Next page">
                    <ChevronRight size={16} />
                  </button>
                ) : <div style={{ width: 28 }} />}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="page-right">
        <div className="page-header">
          <span className="date-stamp">{currentDateStr}</span>
        </div>

        {viewState === 'write' || viewState === 'sinking' ? (
          <div className="ink-input-container">
            <textarea
              ref={textareaRef}
              className={`ink-textarea ${isSinking ? 'ink-sinking' : 'ink-typing'}`}
              placeholder="Write down your thoughts, secrets, or questions for the diary..."
              value={inputText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onDoubleClick={handleSinkIntoPaper}
              disabled={isSinking || isLoading}
              autoFocus
            />

            <div className="action-toolbar" style={{ justifyContent: 'center', borderTop: '1px dashed rgba(139,107,27,0.3)', paddingTop: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: '#8c7355', fontStyle: 'italic' }}>
                Double tap to let paper absorb your words
              </span>
            </div>
          </div>
        ) : (
          <div className="full-page-riddle-container" onDoubleClick={handleWriteNextEntry} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleWriteNextEntry(); } }} tabIndex={0}>
            <div className="riddle-full-text-area" style={{ overflow: 'hidden' }}>
              {showSkeleton ? (
                <div style={{ padding: '12px 0' }}>
                  <div className="skeleton-line long" />
                  <div className="skeleton-line medium" />
                  <div className="skeleton-line long" />
                  <div className="skeleton-line short" />
                </div>
              ) : (() => {
                const isViewingHistory = responseViewIndex >= 0 && responseViewIndex < entries.length;
                if (isViewingHistory) {
                  const entry = entries[responseViewIndex];
                  return entry?.response ? (
                    <TomRiddleWriter text={entry.response} />
                  ) : (
                    <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: '#8c7355', fontSize: '1rem' }}>
                      *Ink absorbed in silence*
                    </p>
                  );
                }
                return activeReply ? (
                  <TomRiddleWriter text={activeReply} />
                ) : silentMessage ? (
                  <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: '#8c7355', fontSize: '1rem' }}>
                    {silentMessage}
                  </p>
                ) : (
                  <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'rgba(140,115,85,0.5)', fontSize: '1rem' }}>
                    The parchment remains quiet...
                  </p>
                );
              })()}
            </div>

            <div className="action-toolbar" style={{ justifyContent: 'center', borderTop: '1px dashed rgba(139,107,27,0.3)', paddingTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: '#8c7355', fontStyle: 'italic' }}>
                  {responseViewIndex >= 0 ? `Entry ${responseViewIndex + 1} of ${entries.length}` : 'Double tap to write next entry'}
                </span>
                {hasNewerResponses && (
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); goNewerResponse(); }} title="Next entry">
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}