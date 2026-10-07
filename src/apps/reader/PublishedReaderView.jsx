import React, { useState, useEffect } from 'react';
import {
  BookOpen, ArrowLeft, Share2, Check, Sun, Moon,
  ChevronLeft, ChevronRight, Edit3, Sparkles, AlertCircle, Type
} from 'lucide-react';

export default function PublishedReaderView({ bookId, onGoToEditor, onBackToBookshelf }) {
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reader Customization Preferences
  const [readerTheme, setReaderTheme] = useState('midnight'); // 'midnight' | 'sepia' | 'light'
  const [fontSize, setFontSize] = useState('medium'); // 'small' | 'medium' | 'large'
  const [copiedLink, setCopiedLink] = useState(false);

  // Page image objects per chapter
  const [chapterImages, setChapterImages] = useState([]);

  useEffect(() => {
    const fetchPublishedBook = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/writer/books/${bookId}`);
        if (!res.ok) throw new Error('Book not found or failed to load');
        const data = await res.json();
        
        setBook(data.book);
        
        // Filter only published chapters for public reader
        const pubChapters = (data.chapters || []).filter(ch => ch.published);
        setChapters(pubChapters);

        if (pubChapters.length > 0) {
          setActiveChapterIndex(0);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (bookId) fetchPublishedBook();
  }, [bookId]);

  const activeChapter = chapters[activeChapterIndex] || null;

  // Load images for current chapter from storage or markdown
  useEffect(() => {
    if (!activeChapter) {
      setChapterImages([]);
      return;
    }

    let imgs = [];
    try {
      const saved = localStorage.getItem(`page_imgs_${activeChapter.id}`);
      if (saved) {
        imgs = JSON.parse(saved);
      }
    } catch (e) {}

    // Fallback: parse markdown image tags in chapter text
    if (!imgs || imgs.length === 0) {
      const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let match;
      let idx = 0;
      while ((match = mdRegex.exec(activeChapter.text)) !== null) {
        idx++;
        imgs.push({
          id: `md_img_${idx}`,
          url: match[2],
          caption: match[1] || 'Illustration',
          position: 'middle',
          paragraphIndex: idx,
          align: 'center',
          size: 'medium'
        });
      }
    }

    setChapterImages(imgs);
  }, [activeChapter]);

  // Copy share link
  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/read/${bookId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Theme Styles mapping
  const themeStyles = {
    midnight: {
      bg: '#0d0f17',
      cardBg: '#161927',
      headerBg: '#121522',
      text: '#e2e8f0',
      textMuted: '#94a3b8',
      accent: '#6366f1',
      border: 'rgba(255, 255, 255, 0.1)',
      fontFamily: `'Merriweather', 'Georgia', serif`
    },
    sepia: {
      bg: '#f7f1e3',
      cardBg: '#f0e6d2',
      headerBg: '#ebdcc5',
      text: '#2d271e',
      textMuted: '#7c6f5e',
      accent: '#8c5e26',
      border: 'rgba(0, 0, 0, 0.1)',
      fontFamily: `'Georgia', serif`
    },
    light: {
      bg: '#f8fafc',
      cardBg: '#ffffff',
      headerBg: '#ffffff',
      text: '#0f172a',
      textMuted: '#64748b',
      accent: '#4f46e5',
      border: '#e2e8f0',
      fontFamily: `'Inter', sans-serif`
    }
  }[readerTheme];

  const fontSizeMap = {
    small: '1.05rem',
    medium: '1.2rem',
    large: '1.4rem'
  };

  const lineHeightMap = {
    small: '1.75',
    medium: '1.85',
    large: '1.95'
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0d0f17',
        color: '#94a3b8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px'
      }}>
        <Sparkles className="animate-spin" size={36} style={{ color: '#6366f1' }} />
        <p style={{ fontSize: '1.1rem' }}>Opening Published Reader...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0d0f17',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center'
      }}>
        <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Book Not Available</h2>
        <p style={{ color: '#94a3b8', maxWidth: '420px', marginBottom: '24px' }}>
          {error || 'This book could not be found or has no published chapters.'}
        </p>
        {onBackToBookshelf && (
          <button
            onClick={onBackToBookshelf}
            style={{
              padding: '10px 20px',
              borderRadius: '999px',
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Return to Bookshelf
          </button>
        )}
      </div>
    );
  }

  // Render formatted paragraphs with embedded images
  const renderChapterBody = () => {
    if (!activeChapter || !activeChapter.text) {
      return (
        <p style={{ fontStyle: 'italic', color: themeStyles.textMuted }}>
          This chapter has no written text yet.
        </p>
      );
    }

    // Strip markdown image tags from text to avoid duplication
    const cleanText = activeChapter.text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '').trim();
    const rawParagraphs = cleanText.split(/\r?\n\s*\r?\n/).filter(Boolean);

    // Group images by paragraph slot
    const topImages = chapterImages.filter(img => img.position === 'top' || img.paragraphIndex === 0);
    const bottomImages = chapterImages.filter(img => img.position === 'bottom' || (img.paragraphIndex !== undefined && img.paragraphIndex > rawParagraphs.length));
    const middleImages = chapterImages.filter(img => img.position === 'middle' || (img.paragraphIndex !== undefined && img.paragraphIndex >= 1 && img.paragraphIndex <= rawParagraphs.length));

    return (
      <div>
        {/* Top Images */}
        {topImages.map(img => (
          <div key={img.id} style={{ margin: '24px 0', textAlign: img.align || 'center' }}>
            <img
              src={img.url}
              alt={img.caption}
              style={{
                maxWidth: img.size === 'small' ? '45%' : img.size === 'medium' ? '75%' : '100%',
                width: '100%',
                height: 'auto',
                maxHeight: '650px',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}
            />
            {img.caption && (
              <div style={{ fontSize: '0.9rem', color: themeStyles.textMuted, marginTop: '8px', fontStyle: 'italic' }}>
                {img.caption}
              </div>
            )}
          </div>
        ))}

        {/* Paragraphs + Middle Images */}
        {rawParagraphs.map((paraText, pIdx) => {
          const paraNum = pIdx + 1;
          const slotImages = middleImages.filter(img => img.paragraphIndex === paraNum);

          return (
            <React.Fragment key={pIdx}>
              <p style={{
                marginBottom: '1.5em',
                fontSize: fontSizeMap[fontSize],
                lineHeight: lineHeightMap[fontSize],
                color: themeStyles.text,
                letterSpacing: '0.01em'
              }}>
                {paraText}
              </p>

              {slotImages.map(img => (
                <div key={img.id} style={{ margin: '28px 0', textAlign: img.align || 'center' }}>
                  <img
                    src={img.url}
                    alt={img.caption}
                    style={{
                      maxWidth: img.size === 'small' ? '45%' : img.size === 'medium' ? '75%' : '100%',
                      width: '100%',
                      height: 'auto',
                      maxHeight: '650px',
                      objectFit: 'contain',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                    }}
                  />
                  {img.caption && (
                    <div style={{ fontSize: '0.9rem', color: themeStyles.textMuted, marginTop: '8px', fontStyle: 'italic' }}>
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </React.Fragment>
          );
        })}

        {/* Bottom Images */}
        {bottomImages.map(img => (
          <div key={img.id} style={{ margin: '24px 0', textAlign: img.align || 'center' }}>
            <img
              src={img.url}
              alt={img.caption}
              style={{
                maxWidth: img.size === 'small' ? '45%' : img.size === 'medium' ? '75%' : '100%',
                width: '100%',
                height: 'auto',
                maxHeight: '650px',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}
            />
            {img.caption && (
              <div style={{ fontSize: '0.9rem', color: themeStyles.textMuted, marginTop: '8px', fontStyle: 'italic' }}>
                {img.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: themeStyles.bg,
      color: themeStyles.text,
      transition: 'background 0.3s ease, color 0.3s ease',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Reader Top Navbar */}
      <header style={{
        height: '64px',
        background: themeStyles.headerBg,
        borderBottom: `1px solid ${themeStyles.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBackToBookshelf && (
            <button
              onClick={onBackToBookshelf}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '999px',
                border: `1px solid ${themeStyles.border}`,
                background: 'transparent',
                color: themeStyles.text,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Bookshelf
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} style={{ color: themeStyles.accent }} />
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{book.title}</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontWeight: 600,
              textTransform: 'uppercase'
            }}>
              Published Story
            </span>
          </div>
        </div>

        {/* Controls: Chapter Selector, Theme, Font Size & Share */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Chapter Selector */}
          {chapters.length > 1 && (
            <select
              value={activeChapterIndex}
              onChange={(e) => setActiveChapterIndex(Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${themeStyles.border}`,
                background: themeStyles.cardBg,
                color: themeStyles.text,
                fontSize: '0.85rem',
                cursor: 'pointer',
                maxWidth: '180px'
              }}
            >
              {chapters.map((ch, idx) => (
                <option key={ch.id} value={idx}>
                  {idx + 1}. {ch.title}
                </option>
              ))}
            </select>
          )}

          {/* Theme Switcher */}
          <div style={{ display: 'flex', background: themeStyles.cardBg, borderRadius: '8px', padding: '3px', border: `1px solid ${themeStyles.border}` }}>
            <button
              onClick={() => setReaderTheme('midnight')}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: 'none',
                background: readerTheme === 'midnight' ? themeStyles.accent : 'transparent',
                color: readerTheme === 'midnight' ? '#fff' : themeStyles.textMuted,
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
              title="Midnight Dark Theme"
            >
              Dark
            </button>
            <button
              onClick={() => setReaderTheme('sepia')}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: 'none',
                background: readerTheme === 'sepia' ? '#8c5e26' : 'transparent',
                color: readerTheme === 'sepia' ? '#fff' : themeStyles.textMuted,
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
              title="Sepia Warm Theme"
            >
              Sepia
            </button>
            <button
              onClick={() => setReaderTheme('light')}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: 'none',
                background: readerTheme === 'light' ? '#4f46e5' : 'transparent',
                color: readerTheme === 'light' ? '#fff' : themeStyles.textMuted,
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
              title="Clean Light Theme"
            >
              Light
            </button>
          </div>

          {/* Font Size Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: themeStyles.cardBg, borderRadius: '8px', padding: '3px', border: `1px solid ${themeStyles.border}` }}>
            <button
              onClick={() => setFontSize('small')}
              style={{
                padding: '4px 8px',
                border: 'none',
                background: fontSize === 'small' ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: themeStyles.text,
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              A-
            </button>
            <button
              onClick={() => setFontSize('large')}
              style={{
                padding: '4px 8px',
                border: 'none',
                background: fontSize === 'large' ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: themeStyles.text,
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '0.95rem',
                fontWeight: 700
              }}
            >
              A+
            </button>
          </div>

          {/* Share Button */}
          <button
            onClick={handleCopyLink}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '999px',
              border: `1px solid ${copiedLink ? '#10b981' : themeStyles.accent}`,
              background: copiedLink ? 'rgba(16, 185, 129, 0.15)' : themeStyles.accent,
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
            {copiedLink ? 'Link Copied!' : 'Share Story'}
          </button>

          {/* Switch to Writer Studio Editor */}
          {onGoToEditor && (
            <button
              onClick={onGoToEditor}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '999px',
                border: `1px solid ${themeStyles.border}`,
                background: 'transparent',
                color: themeStyles.textMuted,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
              title="Switch to Writer Editor"
            >
              <Edit3 size={15} /> Edit
            </button>
          )}
        </div>
      </header>

      {/* Main Reading Container */}
      <main style={{
        maxWidth: '780px',
        margin: '0 auto',
        padding: '48px 24px 80px',
        width: '100%',
        flex: 1
      }}>
        {/* Story Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px', borderBottom: `1px solid ${themeStyles.border}`, paddingBottom: '32px' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            fontFamily: themeStyles.fontFamily,
            letterSpacing: '-0.02em',
            marginBottom: '12px'
          }}>
            {book.title}
          </h1>

          {activeChapter && (
            <h2 style={{
              fontSize: '1.35rem',
              fontWeight: 600,
              color: themeStyles.accent,
              marginTop: '8px'
            }}>
              {activeChapter.title}
            </h2>
          )}
        </div>

        {/* Chapter Body */}
        {chapters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: themeStyles.textMuted }}>
            <p style={{ fontSize: '1.2rem', marginBottom: '12px' }}>No chapters published yet.</p>
            <p style={{ fontSize: '0.95rem' }}>The author is currently polishing this manuscript.</p>
          </div>
        ) : (
          renderChapterBody()
        )}

        {/* Bottom Pagination & Share Bar */}
        {chapters.length > 0 && (
          <div style={{
            marginTop: '64px',
            paddingTop: '32px',
            borderTop: `1px solid ${themeStyles.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <button
              disabled={activeChapterIndex === 0}
              onClick={() => {
                setActiveChapterIndex(prev => Math.max(0, prev - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                border: `1px solid ${themeStyles.border}`,
                background: themeStyles.cardBg,
                color: activeChapterIndex === 0 ? themeStyles.textMuted : themeStyles.text,
                cursor: activeChapterIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: activeChapterIndex === 0 ? 0.5 : 1,
                fontSize: '0.95rem',
                fontWeight: 600
              }}
            >
              <ChevronLeft size={18} /> Previous Chapter
            </button>

            <span style={{ fontSize: '0.9rem', color: themeStyles.textMuted }}>
              Chapter {activeChapterIndex + 1} of {chapters.length}
            </span>

            <button
              disabled={activeChapterIndex === chapters.length - 1}
              onClick={() => {
                setActiveChapterIndex(prev => Math.min(chapters.length - 1, prev + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                border: `1px solid ${themeStyles.border}`,
                background: themeStyles.cardBg,
                color: activeChapterIndex === chapters.length - 1 ? themeStyles.textMuted : themeStyles.text,
                cursor: activeChapterIndex === chapters.length - 1 ? 'not-allowed' : 'pointer',
                opacity: activeChapterIndex === chapters.length - 1 ? 0.5 : 1,
                fontSize: '0.95rem',
                fontWeight: 600
              }}
            >
              Next Chapter <ChevronRight size={18} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
