import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, Sparkles, FileText, Share2, Check } from 'lucide-react';

export default function WriterBookshelf({ onSelectBook }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [copiedBookId, setCopiedBookId] = useState(null);

  const handleCopyLink = (e, bookId) => {
    e.stopPropagation();
    const url = `${window.location.origin}/writer/book/${bookId}`;
    navigator.clipboard.writeText(url);
    setCopiedBookId(bookId);
    setTimeout(() => setCopiedBookId(null), 3000);
  };

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/writer/books');
      if (!res.ok) throw new Error('Failed to fetch books');
      const data = await res.json();
      setBooks(data.books || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleCreateBook = async () => {
    try {
      setCreating(true);
      const res = await fetch('/api/writer/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Story' })
      });
      if (!res.ok) throw new Error('Failed to create book');
      const data = await res.json();
      // Navigate straight into the editor for the new book
      onSelectBook(data.book.id);
    } catch (err) {
      alert('Error creating book: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBook = async (e, bookId, bookTitle) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${bookTitle}" and all its chapters?`)) return;

    try {
      const res = await fetch(`/api/writer/books/${bookId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete book');
      setBooks(prev => prev.filter(b => b.id !== bookId));
    } catch (err) {
      alert('Error deleting book: ' + err.message);
    }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Top Navbar */}
      <header className="writer-app-header">
        <div className="brand-logo">
          <BookOpen className="text-accent" style={{ color: 'var(--accent-primary)' }} size={24} />
          <span>Scribe Studio</span>
          <span className="brand-badge">Writer App</span>
        </div>
      </header>

      {/* Main Bookshelf */}
      <main className="bookshelf-container">
        <div className="bookshelf-header">
          <div>
            <h1 className="bookshelf-title">Your Library</h1>
            <p className="bookshelf-subtitle">Select a manuscript to edit or launch a new story.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Sparkles className="animate-spin" size={28} style={{ margin: '0 auto 12px' }} />
            <p>Loading your bookshelf...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', borderRadius: '12px' }}>
            <p>Error: {error}</p>
            <button onClick={fetchBooks} style={{ marginTop: '12px', textDecoration: 'underline' }}>Retry</button>
          </div>
        ) : (
          <div className="bookshelf-grid">
            {/* New Book Tile */}
            <div className="new-book-card" onClick={handleCreateBook}>
              <div className="new-book-icon">
                {creating ? <Sparkles className="animate-spin" size={24} /> : <Plus size={24} />}
              </div>
              <span style={{ fontWeight: 600 }}>{creating ? 'Creating...' : '+ New book'}</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Starts with Chapter one</span>
            </div>

            {/* Book Cards */}
            {books.map(book => (
              <div
                key={book.id}
                className="book-card"
                onClick={() => onSelectBook(book.id)}
              >
                <div>
                  <div className="book-card-cover" />
                  <h2 className="book-card-title">{book.title}</h2>
                  <div className="book-card-stats">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={14} /> {book.page_count} {book.page_count === 1 ? 'page' : 'pages'}
                    </span>
                  </div>
                </div>

                <div className="book-card-actions" style={{ justifyContent: 'space-between' }}>
                  <button
                    className="reader-tool-btn"
                    style={{
                      fontSize: '0.78rem',
                      background: copiedBookId === book.id ? 'rgba(16, 185, 129, 0.15)' : undefined,
                      borderColor: copiedBookId === book.id ? 'var(--accent-emerald)' : undefined,
                      color: copiedBookId === book.id ? 'var(--accent-emerald)' : undefined
                    }}
                    onClick={(e) => handleCopyLink(e, book.id)}
                    title="Copy direct link to manuscript"
                  >
                    {copiedBookId === book.id ? <Check size={14} /> : <Share2 size={14} />}
                    {copiedBookId === book.id ? 'Copied Link' : 'Share Link'}
                  </button>

                  <button
                    className="delete-chapter-btn"
                    title="Delete book"
                    onClick={(e) => handleDeleteBook(e, book.id, book.title)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

