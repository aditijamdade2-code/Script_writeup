import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react';

export default function ReaderBookshelf({ onSelectBook, theme, setTheme }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/reader/books')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch published books');
        return res.json();
      })
      .then(data => setBooks(data.books || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={`reader-container reader-theme-${theme}`}>
      {/* Reader Navbar */}
      <header className="reader-navbar">
        <div className="reader-navbar-left">
          <span className="reader-brand-title">
            <BookOpen size={20} style={{ color: 'var(--reader-accent)' }} />
            Library
          </span>
        </div>

        <div className="reader-controls">
          {/* Theme switcher */}
          <button
            className="reader-tool-btn"
            onClick={() => {
              const themes = ['sepia', 'light', 'dark'];
              const next = themes[(themes.indexOf(theme) + 1) % themes.length];
              setTheme(next);
            }}
          >
            Theme: <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{theme}</span>
          </button>
        </div>
      </header>

      {/* Reader Bookshelf Container */}
      <main className="reader-bookshelf-container">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 700, marginBottom: '8px' }}>
          Published Works
        </h1>
        <p style={{ color: 'var(--reader-muted)', fontSize: '1rem' }}>
          Select a book to begin reading.
        </p>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--reader-muted)' }}>
            <Sparkles className="animate-spin" size={28} style={{ margin: '0 auto 12px' }} />
            <p>Loading library...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '32px', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', borderRadius: '12px', marginTop: '24px' }}>
            <p>Error: {error}</p>
          </div>
        ) : books.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--reader-muted)', background: 'var(--reader-card-bg)', borderRadius: '16px', marginTop: '32px' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No published books available yet.</p>
            <p style={{ fontSize: '0.9rem' }}>Books will appear here once chapters are marked as published in the Writer App.</p>
          </div>
        ) : (
          <div className="reader-bookshelf-grid">
            {books.map(book => (
              <div
                key={book.id}
                className="reader-book-card"
                onClick={() => onSelectBook(book.id)}
              >
                <div>
                  <div style={{ height: '4px', width: '32px', background: 'var(--reader-accent)', borderRadius: '999px', marginBottom: '16px' }} />
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, marginBottom: '8px' }}>
                    {book.title}
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--reader-muted)' }}>
                    {book.published_page_count} {book.published_page_count === 1 ? 'chapter' : 'chapters'} available
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: 'var(--reader-accent)', fontWeight: 600, fontSize: '0.9rem', marginTop: '20px' }}>
                  Read <ChevronRight size={16} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
