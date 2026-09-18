import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, BookOpen, ChevronLeft, ChevronRight,
  Sun, Moon, Type, List, Sparkles
} from 'lucide-react';

export default function ReaderView({ bookId, onBackToBookshelf, theme, setTheme }) {
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(19); // px
  const [tocOpen, setTocOpen] = useState(true);

  const surfaceRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    async function loadReaderData() {
      try {
        setLoading(true);
        // STRICT READ-ONLY ENDPOINT
        const res = await fetch(`/api/reader/books/${bookId}`);
        if (!res.ok) throw new Error('Book not found or has no published chapters');
        const data = await res.json();
        
        setBook(data.book);
        setChapters(data.chapters || []);
        if (data.chapters && data.chapters.length > 0) {
          setActiveChapterIndex(0);
        }
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    if (bookId) loadReaderData();
  }, [bookId]);

  // Track scroll progress for reading bar
  const handleScroll = (e) => {
    const el = e.target;
    const total = el.scrollHeight - el.clientHeight;
    if (total > 0) {
      setScrollProgress((el.scrollTop / total) * 100);
    } else {
      setScrollProgress(100);
    }
  };

  const activeChapter = chapters[activeChapterIndex];

  const wordCount = activeChapter?.text ? activeChapter.text.trim().split(/\s+/).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  if (loading) {
    return (
      <div className={`reader-container reader-theme-${theme}`} style={{ justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Sparkles className="animate-spin" size={32} style={{ color: 'var(--reader-accent)', marginBottom: '16px' }} />
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem' }}>Opening book...</p>
      </div>
    );
  }

  if (!book || chapters.length === 0) {
    return (
      <div className={`reader-container reader-theme-${theme}`} style={{ padding: '60px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '16px' }}>No Published Content</h2>
        <p style={{ color: 'var(--reader-muted)', marginBottom: '24px' }}>
          This manuscript does not have any published chapters available yet.
        </p>
        <button className="reader-tool-btn" onClick={onBackToBookshelf} style={{ margin: '0 auto' }}>
          <ArrowLeft size={16} /> Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className={`reader-container reader-theme-${theme}`}>
      {/* Reader Header */}
      <header className="reader-navbar">
        <div className="reader-navbar-left">
          <button className="reader-tool-btn" onClick={onBackToBookshelf}>
            <ArrowLeft size={16} /> Library
          </button>
          <span className="reader-brand-title" style={{ fontSize: '1rem', opacity: 0.9 }}>
            {book.title}
          </span>
        </div>

        <div className="reader-controls">
          {/* Toggle Table of Contents */}
          <button
            className="reader-tool-btn"
            onClick={() => setTocOpen(!tocOpen)}
            title="Toggle Table of Contents"
          >
            <List size={16} />
          </button>

          {/* Font Size Adjuster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--reader-border)', borderRadius: '999px', padding: '2px 8px' }}>
            <button
              style={{ fontSize: '0.8rem', color: 'inherit', opacity: fontSize <= 15 ? 0.3 : 1 }}
              onClick={() => setFontSize(prev => Math.max(15, prev - 2))}
            >
              A-
            </button>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{fontSize}px</span>
            <button
              style={{ fontSize: '0.9rem', color: 'inherit', opacity: fontSize >= 27 ? 0.3 : 1 }}
              onClick={() => setFontSize(prev => Math.min(27, prev + 2))}
            >
              A+
            </button>
          </div>

          {/* Theme Switcher */}
          <button
            className="reader-tool-btn"
            onClick={() => {
              const themes = ['sepia', 'light', 'dark'];
              const next = themes[(themes.indexOf(theme) + 1) % themes.length];
              setTheme(next);
            }}
          >
            <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{theme}</span>
          </button>
        </div>
      </header>

      {/* Reading Progress Track */}
      <div className="reader-progress-track">
        <div className="reader-progress-fill" style={{ width: `${scrollProgress}%` }} />
      </div>

      {/* Main Content Layout */}
      <div className="reader-content-wrapper">
        {/* Table of Contents Drawer */}
        {tocOpen && (
          <aside className="reader-toc-sidebar">
            <span className="reader-toc-title">Chapters ({chapters.length})</span>
            {chapters.map((ch, idx) => (
              <div
                key={ch.id}
                className={`reader-toc-item ${idx === activeChapterIndex ? 'active' : ''}`}
                onClick={() => {
                  setActiveChapterIndex(idx);
                  if (surfaceRef.current) surfaceRef.current.scrollTop = 0;
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--reader-muted)', marginBottom: '2px' }}>
                  Chapter {idx + 1}
                </div>
                <div>{ch.title}</div>
              </div>
            ))}
          </aside>
        )}

        {/* Serene Reading Surface */}
        <main
          ref={surfaceRef}
          onScroll={handleScroll}
          className="reader-main-surface"
          style={{ height: 'calc(100vh - 63px)', overflowY: 'auto' }}
        >
          <article className="reader-article animate-fade-in" key={activeChapter.id}>
            <header className="reader-chapter-meta">
              <div className="reader-book-heading">{book.title}</div>
              <h1 className="reader-chapter-title">{activeChapter.title}</h1>
              <div className="reader-read-time">{wordCount} words &bull; ~{readTimeMin} min read</div>
            </header>

            <div
              className="reader-body-text"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.85 }}
            >
              {activeChapter.text || (
                <em style={{ color: 'var(--reader-muted)' }}>This chapter is blank.</em>
              )}
            </div>

            {/* Chapter Navigation Footer */}
            <footer className="reader-nav-footer">
              <button
                className="reader-nav-btn"
                disabled={activeChapterIndex <= 0}
                onClick={() => {
                  setActiveChapterIndex(prev => Math.max(0, prev - 1));
                  if (surfaceRef.current) surfaceRef.current.scrollTop = 0;
                }}
              >
                <ChevronLeft size={18} /> Previous Chapter
              </button>

              <span style={{ fontSize: '0.85rem', color: 'var(--reader-muted)' }}>
                {activeChapterIndex + 1} of {chapters.length}
              </span>

              <button
                className="reader-nav-btn"
                disabled={activeChapterIndex >= chapters.length - 1}
                onClick={() => {
                  setActiveChapterIndex(prev => Math.min(chapters.length - 1, prev + 1));
                  if (surfaceRef.current) surfaceRef.current.scrollTop = 0;
                }}
              >
                Next Chapter <ChevronRight size={18} />
              </button>
            </footer>
          </article>
        </main>
      </div>
    </div>
  );
}
