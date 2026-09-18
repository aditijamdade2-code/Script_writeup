import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, Sparkles,
  AlertCircle, RefreshCw, Eye, BookOpen, Clock, FileText, Check, Share2, Copy
} from 'lucide-react';

export default function WriterEditor({ bookId, onBackToBookshelf, onOpenReader }) {
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Active Chapter Form State
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [published, setPublished] = useState(true);
  
  // Unsaved changes tracking
  const [isUnsaved, setIsUnsaved] = useState(false);
  
  // Confirm & Suggestions State
  const [isConfirming, setIsConfirming] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState(false);

  // Editable Book Title State
  const [editingBookTitle, setEditingBookTitle] = useState(false);
  const [bookTitleInput, setBookTitleInput] = useState('');

  // Ref to track last saved state for unsaved check
  const originalStateRef = useRef({ title: '', text: '', published: true });

  // 1. Load Book & Chapters on mount or bookId change
  const fetchBookData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/writer/books/${bookId}`);
      if (!res.ok) throw new Error('Failed to load book data');
      const data = await res.json();
      
      setBook(data.book);
      setBookTitleInput(data.book.title);
      setChapters(data.chapters || []);

      if (data.chapters && data.chapters.length > 0) {
        // Select first chapter by default
        selectChapter(data.chapters[0]);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookId) fetchBookData();
  }, [bookId]);

  // Select a chapter and populate editor fields
  const selectChapter = (ch) => {
    setSelectedChapterId(ch.id);
    setTitle(ch.title || '');
    setText(ch.text || '');
    setPublished(ch.published !== undefined ? ch.published : true);
    setSuggestions(ch.suggestions || []);
    setSuggestionsError(null);

    originalStateRef.current = {
      title: ch.title || '',
      text: ch.text || '',
      published: ch.published !== undefined ? ch.published : true
    };
    setIsUnsaved(false);
  };

  // Track unsaved changes in real time
  const handleTitleChange = (val) => {
    setTitle(val);
    checkUnsaved(val, text, published);
  };

  const handleTextChange = (val) => {
    setText(val);
    checkUnsaved(title, val, published);
  };

  const handlePublishedToggle = () => {
    const nextVal = !published;
    setPublished(nextVal);
    checkUnsaved(title, text, nextVal);
  };

  const checkUnsaved = (curTitle, curText, curPublished) => {
    const orig = originalStateRef.current;
    const changed = (curTitle !== orig.title || curText !== orig.text || curPublished !== orig.published);
    setIsUnsaved(changed);
  };

  // 2. Add New Page / Chapter
  const handleAddPage = async () => {
    try {
      const res = await fetch(`/api/writer/books/${bookId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Chapter ${chapters.length + 1}`,
          text: '',
          published: true
        })
      });
      if (!res.ok) throw new Error('Failed to add new page');
      const data = await res.json();
      
      const newCh = data.chapter;
      setChapters(prev => [...prev, newCh]);
      selectChapter(newCh);
    } catch (err) {
      alert('Error adding page: ' + err.message);
    }
  };

  // 3. Delete Chapter
  const handleDeleteChapter = async (e, chId) => {
    e.stopPropagation();
    if (chapters.length <= 1) {
      alert('A book must have at least one chapter.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this page?')) return;

    try {
      const res = await fetch(`/api/writer/chapters/${chId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete chapter');
      }

      const updatedChapters = chapters.filter(c => c.id !== chId);
      setChapters(updatedChapters);

      // If deleted chapter was selected, switch to adjacent chapter
      if (chId === selectedChapterId) {
        selectChapter(updatedChapters[0]);
      }
    } catch (err) {
      alert('Error deleting page: ' + err.message);
    }
  };

  // 4. Save Book Title
  const handleSaveBookTitle = async () => {
    if (!bookTitleInput.trim() || bookTitleInput === book?.title) {
      setEditingBookTitle(false);
      return;
    }
    try {
      const res = await fetch(`/api/writer/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookTitleInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setBook(data.book);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditingBookTitle(false);
    }
  };

  // 5. CORE CONFIRM BEHAVIOR:
  // Step 1: Save title/text immediately
  // Step 2: Trigger AI suggestion call in same action & update right panel
  const handleConfirm = async () => {
    if (!selectedChapterId || isConfirming) return;

    setIsConfirming(true);
    setSuggestionsError(null);
    setSuggestionsLoading(true);

    let saveSuccess = false;

    // STEP 1: Save Title/Text immediately
    try {
      const saveRes = await fetch(`/api/writer/chapters/${selectedChapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, published })
      });

      if (!saveRes.ok) throw new Error('Failed to save chapter text');
      const saveData = await saveRes.json();
      
      // Update local chapter list item title/published status
      setChapters(prev => prev.map(c => c.id === selectedChapterId ? saveData.chapter : c));

      // Reset unsaved flag
      originalStateRef.current = { title, text, published };
      setIsUnsaved(false);
      saveSuccess = true;

      // Show temporary save badge
      setSavedSuccessMsg(true);
      setTimeout(() => setSavedSuccessMsg(false), 2500);
    } catch (err) {
      alert('Failed to save chapter: ' + err.message);
      setIsConfirming(false);
      setSuggestionsLoading(false);
      return; // Do not proceed to suggestions if save failed
    }

    // STEP 2: Send text to AI suggestion service in same action
    try {
      const sugRes = await fetch(`/api/writer/chapters/${selectedChapterId}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text })
      });

      if (!sugRes.ok) {
        throw new Error('AI suggestion service error');
      }

      const sugData = await sugRes.json();
      const newSuggestions = sugData.suggestions || [];

      setSuggestions(newSuggestions);
      
      // Update chapter in local list with persisted suggestions
      setChapters(prev => prev.map(c => c.id === selectedChapterId ? { ...c, suggestions: newSuggestions } : c));
    } catch (err) {
      console.error('Suggestion generation error:', err);
      // NOTE requirement: "the page save itself must not be blocked or rolled back by a failed suggestion call."
      setSuggestionsError('Unable to generate suggestions. The chapter save was successful.');
    } finally {
      setSuggestionsLoading(false);
      setIsConfirming(false);
    }
  };

  // Retry suggestion call
  const handleRetrySuggestions = () => {
    handleConfirm();
  };

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter to confirm
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  // Copy Shareable Reader Link
  const [copiedLink, setCopiedLink] = useState(false);
  const handleCopyShareLink = () => {
    const readerUrl = `${window.location.origin}/read/${bookId}`;
    navigator.clipboard.writeText(readerUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Calculations for Stats
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  if (loading) {
    return (
      <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Sparkles className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} />
        <p>Loading editor workspace...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header className="writer-app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="reader-tool-btn" onClick={onBackToBookshelf}>
            <ArrowLeft size={16} /> Bookshelf
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editingBookTitle ? (
              <input
                className="editor-title-input"
                style={{ fontSize: '1rem', width: '220px' }}
                value={bookTitleInput}
                onChange={(e) => setBookTitleInput(e.target.value)}
                onBlur={handleSaveBookTitle}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBookTitle()}
                autoFocus
              />
            ) : (
              <span
                style={{ fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setEditingBookTitle(true)}
                title="Click to rename book"
              >
                {book?.title}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="reader-tool-btn"
            style={{
              background: copiedLink ? 'rgba(16, 185, 129, 0.15)' : undefined,
              borderColor: copiedLink ? 'var(--accent-emerald)' : undefined,
              color: copiedLink ? 'var(--accent-emerald)' : undefined
            }}
            onClick={handleCopyShareLink}
            title="Copy public link to share with readers in other cities"
          >
            {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
            {copiedLink ? 'Link Copied!' : 'Copy Shareable Link'}
          </button>

          <button className="reader-tool-btn" onClick={() => onOpenReader(bookId)}>
            <Eye size={16} /> Open Reader App
          </button>
        </div>
      </header>

      {/* 3-Column Editor Main Workspace */}
      <div className="editor-workspace">
        {/* LEFT COLUMN — Chapter List */}
        <aside className="chapters-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">Pages ({chapters.length})</span>
          </div>

          <div className="chapters-list">
            {chapters.map((ch, index) => {
              const isSelected = ch.id === selectedChapterId;
              return (
                <div
                  key={ch.id}
                  className={`chapter-item ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    if (isUnsaved && !window.confirm('You have unsaved changes on this page. Switch anyway?')) {
                      return;
                    }
                    selectChapter(ch);
                  }}
                >
                  <div className="chapter-item-left">
                    <span className="chapter-num-badge">{index + 1}</span>
                    <span className="chapter-title-text">{ch.title || 'Untitled'}</span>
                  </div>

                  <div className="chapter-item-right">
                    <span
                      className={`status-dot ${ch.published ? 'published' : 'draft'}`}
                      title={ch.published ? 'Published' : 'Draft mode'}
                    />
                    <button
                      className="delete-chapter-btn"
                      disabled={chapters.length <= 1}
                      title={chapters.length <= 1 ? "Cannot delete the only chapter" : "Delete page"}
                      onClick={(e) => handleDeleteChapter(e, ch.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sidebar-footer">
            <button className="add-page-btn" onClick={handleAddPage}>
              <Plus size={16} /> + New page
            </button>
          </div>
        </aside>

        {/* MIDDLE COLUMN — Editor Canvas */}
        <section className="editor-main">
          {/* Editor Header Toolbar */}
          <div className="editor-toolbar">
            <div className="editor-toolbar-left">
              <input
                className="editor-title-input"
                placeholder="Page Title (e.g. Chapter One)"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            <div className="editor-toolbar-right">
              {/* Draft vs Published Toggle */}
              <div
                className="toggle-publish-wrapper"
                onClick={handlePublishedToggle}
                title="Published chapters appear in the Reader App"
              >
                <div className={`toggle-switch ${published ? 'active' : ''}`}>
                  <div className="toggle-slider" />
                </div>
                <span>{published ? 'Published' : 'Draft'}</span>
              </div>

              {/* Unsaved indicator badge */}
              {isUnsaved && (
                <span className="unsaved-badge" title="Click Confirm to save changes and update suggestions">
                  Unsaved changes
                </span>
              )}

              {savedSuccessMsg && (
                <span style={{ color: 'var(--accent-emerald)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={14} /> Saved
                </span>
              )}

              {/* CONFIRM BUTTON */}
              <button
                className="confirm-btn"
                disabled={isConfirming}
                onClick={handleConfirm}
                title="Save page and generate AI suggestions (Ctrl+Enter)"
              >
                {isConfirming ? (
                  <>
                    <Sparkles className="animate-spin" size={16} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Confirm</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Text Area Writing Surface */}
          <div className="editor-body">
            <textarea
              className="editor-textarea"
              placeholder="Start writing your chapter here..."
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div className="editor-footer-stats">
              <span>{wordCount} words &bull; {charCount} characters</span>
              <span>~{readTimeMin} min read &bull; Shortcut: <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + Enter</kbd> to Confirm</span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN — Suggestions Panel */}
        <aside className="suggestions-sidebar">
          <div className="suggestions-header">
            <span className="suggestions-title">
              <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
              AI Suggestions
            </span>
            {suggestionsLoading && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Analyzing...</span>
            )}
          </div>

          <div className="suggestions-content">
            {suggestionsLoading ? (
              <>
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Sparkles className="animate-spin" size={24} style={{ margin: '0 auto 8px', color: 'var(--accent-primary)' }} />
                  Analyzing pacing, dialogue & imagery...
                </div>
                <div className="suggestion-skeleton">
                  <div className="skeleton-line short" />
                  <div className="skeleton-line medium" />
                  <div className="skeleton-line" />
                </div>
                <div className="suggestion-skeleton">
                  <div className="skeleton-line short" />
                  <div className="skeleton-line medium" />
                </div>
              </>
            ) : suggestionsError ? (
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '16px', borderRadius: '8px', color: 'var(--text-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-rose)', fontWeight: 600, marginBottom: '8px' }}>
                  <AlertCircle size={16} /> AI Suggestion Notice
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {suggestionsError}
                </p>
                <button
                  className="reader-tool-btn"
                  style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}
                  onClick={handleRetrySuggestions}
                >
                  <RefreshCw size={14} /> Retry Suggestions
                </button>
              </div>
            ) : suggestions && suggestions.length > 0 ? (
              suggestions.map((item, idx) => (
                <div key={idx} className="suggestion-card">
                  <div className="suggestion-quote">
                    "{item.quote}"
                  </div>
                  <div className="suggestion-note">
                    {item.note}
                  </div>
                </div>
              ))
            ) : (
              <div className="suggestions-empty">
                <div className="suggestions-empty-icon">
                  <Sparkles size={20} />
                </div>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No suggestions yet</span>
                <p style={{ fontSize: '0.85rem' }}>
                  Click <strong>Confirm</strong> to save your page and receive marginal editorial notes.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
