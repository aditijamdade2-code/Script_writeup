import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, Sparkles,
  AlertCircle, RefreshCw, Eye, BookOpen, Clock, FileText, Check, Share2, Copy, Send,
  Image, Upload, X, Link as LinkIcon, ArrowUp, ArrowDown, Maximize2, Minimize2, GripVertical,
  AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';

export default function WriterEditor({ bookId, onBackToBookshelf, onViewPublished }) {
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPublishModal, setShowPublishModal] = useState(false);
  
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

  // Custom Prompt Typing State
  const [customPrompt, setCustomPrompt] = useState('');

  // Image Upload & Modal State
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageTab, setImageTab] = useState('upload'); // 'upload' | 'url'
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageCaptionInput, setImageCaptionInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

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

  // Send custom prompt typing request to AI service
  const handleSendCustomPrompt = async (promptOverride) => {
    const targetPrompt = promptOverride !== undefined ? promptOverride : customPrompt;
    if (!selectedChapterId || !targetPrompt || !targetPrompt.trim() || suggestionsLoading) return;

    setSuggestionsLoading(true);
    setSuggestionsError(null);

    try {
      const res = await fetch(`/api/writer/chapters/${selectedChapterId}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, customPrompt: targetPrompt.trim() })
      });

      if (!res.ok) throw new Error('AI suggestion service error');

      const data = await res.json();
      const newSuggestions = data.suggestions || [];
      setSuggestions(newSuggestions);

      // Save suggestions locally
      setChapters(prev => prev.map(c => c.id === selectedChapterId ? { ...c, suggestions: newSuggestions } : c));
      
      if (promptOverride !== undefined) {
        setCustomPrompt(promptOverride);
      }
    } catch (err) {
      console.error('Custom suggestion error:', err);
      setSuggestionsError('Unable to generate custom feedback. Please try again.');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter to confirm
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  // Page Illustrations State (keyed by selectedChapterId)
  const [pageImagesMap, setPageImagesMap] = useState({});

  // Load images for selected chapter from localStorage
  useEffect(() => {
    if (selectedChapterId) {
      try {
        const saved = localStorage.getItem(`page_imgs_${selectedChapterId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setPageImagesMap(prev => ({ ...prev, [selectedChapterId]: parsed }));
        }
      } catch (e) {
        console.error('Error loading page images:', e);
      }
    }
  }, [selectedChapterId]);

  // Image Compression helper to prevent LocalStorage/Memory quota errors with large PNG files
  const compressImageFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Use PNG format if original file was PNG, otherwise JPEG
          const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const compressed = canvas.toDataURL(mimeType, 0.88);
          resolve(compressed);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // Local storage helper for image data URLs
  const storeLocalBase64 = (base64) => {
    if (!base64) return '';
    const key = `script_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      localStorage.setItem(key, base64);
      return `/local-img/${key}`;
    } catch (e) {
      console.warn('LocalStorage limit reached, storing raw data URL fallback', e);
      return base64; // Return raw data URL directly so image displays 100% reliably!
    }
  };

  const resolveImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('/local-img/')) {
      const key = url.replace('/local-img/', '');
      const stored = localStorage.getItem(key);
      if (stored) return stored;
    }
    return url;
  };

  // Auto-clean any legacy image tags out of text so textarea stays 100% clean story prose
  useEffect(() => {
    if (text && text.includes('![')) {
      const cleanedText = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '').trim();
      if (cleanedText !== text) {
        handleTextChange(cleanedText);
      }
    }
  }, [text]);

  // Add Image to Page Gallery (Default position: 'middle' in between paragraphs)
  const handleInsertImageMark = (url, caption) => {
    if (!url || !selectedChapterId) return;
    const cleanCap = caption ? caption.trim() : 'Illustration';
    const resolvedUrl = resolveImgUrl(url);

    const paras = (text || '').split(/\n\n+/).filter(Boolean);
    const midIndex = Math.max(1, Math.floor((paras.length || 1) / 2));

    const newImageObj = {
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      caption: cleanCap,
      url: resolvedUrl,
      position: 'middle', // 'top' | 'middle' | 'bottom'
      paragraphIndex: midIndex, // Insert in the middle between paragraphs
      align: 'center', // 'left' | 'center' | 'right'
      size: 'full' // 'small' | 'medium' | 'full'
    };

    setPageImagesMap(prev => {
      const currentList = prev[selectedChapterId] || [];
      const updatedList = [...currentList, newImageObj];
      try {
        localStorage.setItem(`page_imgs_${selectedChapterId}`, JSON.stringify(updatedList));
      } catch (e) {
        console.error('Error saving image list:', e);
      }
      return { ...prev, [selectedChapterId]: updatedList };
    });

    // Reset Modal
    setShowImageModal(false);
    setImageUrlInput('');
    setImageCaptionInput('');
  };

  // Update Image Properties (Position, Size, Align, ParagraphIndex)
  const handleUpdateImageProp = (imgId, key, value) => {
    if (!selectedChapterId) return;
    setPageImagesMap(prev => {
      const currentList = prev[selectedChapterId] || [];
      const updatedList = currentList.map(img => {
        if (img.id === imgId) {
          // Reset x/y transform offsets so image snaps cleanly in layout flow without covering text
          return { ...img, [key]: value, x: 0, y: 0 };
        }
        return img;
      });
      try {
        localStorage.setItem(`page_imgs_${selectedChapterId}`, JSON.stringify(updatedList));
      } catch (e) {
        console.error('Error updating image property:', e);
      }
      return { ...prev, [selectedChapterId]: updatedList };
    });
  };

  // Pointer Drag Handler for Free Image Movement & Direct Dragging on Image
  const [activeDragImgId, setActiveDragImgId] = useState(null);
  const dragStartPosRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const handlePointerDown = (e, img) => {
    // If user clicked inside control overlay buttons, do not initiate card drag
    if (e.target.closest('button')) return;

    e.stopPropagation();
    setActiveDragImgId(img.id);
    dragStartPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: img.x || 0,
      initialY: img.y || 0
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handlePointerMove = (e, img) => {
    if (activeDragImgId !== img.id) return;
    e.stopPropagation();

    const rawDx = e.clientX - dragStartPosRef.current.x;
    const rawDy = e.clientY - dragStartPosRef.current.y;

    // Clamp visual drag displacement to smooth bounds so image NEVER shoots out of frame
    const clampedX = Math.max(-220, Math.min(220, dragStartPosRef.current.initialX + rawDx));
    const clampedY = Math.max(-160, Math.min(160, dragStartPosRef.current.initialY + rawDy));

    setPageImagesMap(prev => {
      const currentList = prev[selectedChapterId] || [];
      const updatedList = currentList.map(item => item.id === img.id ? {
        ...item,
        x: clampedX,
        y: clampedY
      } : item);
      return { ...prev, [selectedChapterId]: updatedList };
    });
  };

  const handlePointerUp = (e, img, totalParas = 1) => {
    if (activeDragImgId !== img.id) return;
    e.stopPropagation();
    setActiveDragImgId(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    // Evaluate total displacement on drag release
    const finalX = img.x || 0;
    const finalY = img.y || 0;

    const currentIdx = img.paragraphIndex !== undefined ? img.paragraphIndex : 1;
    let newParaIdx = currentIdx;
    let newPos = img.position || 'middle';

    if (finalY > 50) {
      if (currentIdx >= totalParas) {
        newPos = 'bottom';
        newParaIdx = totalParas;
      } else {
        newParaIdx = currentIdx + 1;
        newPos = 'middle';
      }
    } else if (finalY < -50) {
      if (currentIdx <= 1) {
        newPos = 'top';
        newParaIdx = 0;
      } else {
        newParaIdx = currentIdx - 1;
        newPos = 'middle';
      }
    }

    let newAlign = img.align || 'center';
    if (finalX > 80) {
      newAlign = 'right';
    } else if (finalX < -80) {
      newAlign = 'left';
    }

    // Reset x and y offsets back to 0 so it snaps perfectly in layout flow without lingering off-screen transforms!
    setPageImagesMap(prev => {
      const currentList = prev[selectedChapterId] || [];
      const updatedList = currentList.map(item => item.id === img.id ? {
        ...item,
        x: 0,
        y: 0,
        position: newPos,
        paragraphIndex: newParaIdx,
        align: newAlign
      } : item);
      try {
        localStorage.setItem(`page_imgs_${selectedChapterId}`, JSON.stringify(updatedList));
      } catch (err) {}
      return { ...prev, [selectedChapterId]: updatedList };
    });
  };

  // Reusable Image Card Renderer with Full Card Dragging & Toolbar Alignment
  const renderImageCard = (img, totalParas = 1) => (
    <div
      key={img.id}
      className={`page-illustration-card size-${img.size || 'medium'} ${activeDragImgId === img.id ? 'is-dragging' : ''}`}
      onPointerDown={(e) => handlePointerDown(e, img)}
      onPointerMove={(e) => handlePointerMove(e, img)}
      onPointerUp={(e) => handlePointerUp(e, img, totalParas)}
      style={{
        touchAction: 'none',
        cursor: activeDragImgId === img.id ? 'grabbing' : 'grab',
        transform: activeDragImgId === img.id ? `translate3d(${img.x || 0}px, ${img.y || 0}px, 0px)` : 'none',
        transition: activeDragImgId === img.id ? 'none' : 'all 0.2s ease'
      }}
    >
      {/* Controls Overlay */}
      <div className="illustration-controls-overlay" onPointerDown={(e) => e.stopPropagation()}>
        <button
          className="img-control-btn"
          style={{ cursor: 'grab' }}
          title="Click & drag anywhere on image to move"
          onPointerDown={(e) => handlePointerDown(e, img)}
        >
          <GripVertical size={13} />
        </button>

        {/* Alignment Toggles */}
        <button
          className={`img-control-btn ${img.align === 'left' ? 'active' : ''}`}
          title="Align Left"
          onClick={() => handleUpdateImageProp(img.id, 'align', 'left')}
        >
          <AlignLeft size={13} />
        </button>
        <button
          className={`img-control-btn ${img.align === 'center' || !img.align ? 'active' : ''}`}
          title="Align Center"
          onClick={() => handleUpdateImageProp(img.id, 'align', 'center')}
        >
          <AlignCenter size={13} />
        </button>
        <button
          className={`img-control-btn ${img.align === 'right' ? 'active' : ''}`}
          title="Align Right"
          onClick={() => handleUpdateImageProp(img.id, 'align', 'right')}
        >
          <AlignRight size={13} />
        </button>

        {/* Move Up / Move Down Paragraph Toggles */}
        <button
          className="img-control-btn"
          title="Move Up (above paragraph)"
          onClick={() => {
            const currentIdx = img.paragraphIndex !== undefined ? img.paragraphIndex : 1;
            if (currentIdx <= 1) {
              handleUpdateImageProp(img.id, 'position', 'top');
              handleUpdateImageProp(img.id, 'paragraphIndex', 0);
            } else {
              handleUpdateImageProp(img.id, 'position', 'middle');
              handleUpdateImageProp(img.id, 'paragraphIndex', currentIdx - 1);
            }
          }}
        >
          <ArrowUp size={13} />
        </button>
        <button
          className="img-control-btn"
          title="Move Down (below paragraph)"
          onClick={() => {
            const currentIdx = img.paragraphIndex !== undefined ? img.paragraphIndex : 1;
            if (currentIdx >= totalParas) {
              handleUpdateImageProp(img.id, 'position', 'bottom');
              handleUpdateImageProp(img.id, 'paragraphIndex', totalParas);
            } else {
              handleUpdateImageProp(img.id, 'position', 'middle');
              handleUpdateImageProp(img.id, 'paragraphIndex', currentIdx + 1);
            }
          }}
        >
          <ArrowDown size={13} />
        </button>

        {/* Size */}
        <button
          className="img-control-btn"
          title={`Resize (${img.size || 'medium'})`}
          onClick={() => {
            const nextSize = img.size === 'small' ? 'medium' : img.size === 'medium' ? 'full' : 'small';
            handleUpdateImageProp(img.id, 'size', nextSize);
          }}
        >
          {img.size === 'full' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>

        {/* Trash */}
        <button
          className="img-control-btn"
          title="Remove image from page"
          onClick={() => handleRemoveImageObj(img.id)}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <img
        src={img.url}
        alt={img.caption}
        className="illustration-img"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />
      <div className="illustration-caption">{img.caption || 'Illustration'}</div>
    </div>
  );

  // Remove Image from Page Gallery
  const handleRemoveImageObj = (imgId) => {
    if (!selectedChapterId) return;
    setPageImagesMap(prev => {
      const currentList = prev[selectedChapterId] || [];
      const updatedList = currentList.filter(img => img.id !== imgId);
      try {
        localStorage.setItem(`page_imgs_${selectedChapterId}`, JSON.stringify(updatedList));
      } catch (e) {
        console.error('Error updating image list:', e);
      }
      return { ...prev, [selectedChapterId]: updatedList };
    });
  };

  // Handle Upload Local Image File
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const compressedDataUrl = await compressImageFile(file);
      if (!compressedDataUrl) throw new Error('Failed to process image file');

      try {
        const res = await fetch('/api/writer/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: compressedDataUrl })
        });
        if (res.ok) {
          const data = await res.json();
          handleInsertImageMark(data.url, imageCaptionInput || file.name);
        } else {
          const shortUrl = storeLocalBase64(compressedDataUrl);
          handleInsertImageMark(shortUrl, imageCaptionInput || file.name);
        }
      } catch (err) {
        const shortUrl = storeLocalBase64(compressedDataUrl);
        handleInsertImageMark(shortUrl, imageCaptionInput || file.name);
      }
    } catch (err) {
      alert('Error processing image file: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Current page images list
  const currentChapterImages = pageImagesMap[selectedChapterId] || [];

  // Copy Direct Link to Published Reader
  const [copiedLink, setCopiedLink] = useState(false);
  const handleCopyShareLink = () => {
    const publishedUrl = `${window.location.origin}/read/${bookId}`;
    navigator.clipboard.writeText(publishedUrl);
    setCopiedLink(true);
    setShowPublishModal(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Calculations for Stats (excluding image tags for clean word/char count)
  const cleanTextForStats = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  const wordCount = cleanTextForStats.trim() ? cleanTextForStats.trim().split(/\s+/).length : 0;
  const charCount = cleanTextForStats.length;
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
          {onViewPublished && (
            <button
              className="reader-tool-btn"
              onClick={onViewPublished}
              title="Preview Published Story as a Reader"
            >
              <Eye size={16} /> Preview Story
            </button>
          )}

          <button
            className="confirm-btn"
            style={{ padding: '6px 16px', fontSize: '0.85rem' }}
            onClick={handleCopyShareLink}
            title="Publish & Copy Public Reader Link"
          >
            {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
            {copiedLink ? 'Link Copied!' : 'Publish & Share'}
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
              {/* Insert Image Button */}
              <button
                className="reader-tool-btn"
                onClick={() => setShowImageModal(true)}
                title="Insert image or illustration into page"
              >
                <Image size={16} />
                <span>Add Image</span>
              </button>

              {/* Draft vs Published Toggle */}
              <div
                className="toggle-publish-wrapper"
                onClick={handlePublishedToggle}
                title="Toggle published status"
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

          {/* Text Area Writing Surface & Middle Flowing Illustrations */}
          <div className="editor-body">
            {(() => {
              const rawParas = (text || '').split(/\r?\n\s*\r?\n/);
              const paras = rawParas.length > 0 && rawParas[0] !== '' ? rawParas : [text || ''];

              const renderImagesForSlot = (slotIndex) => {
                return currentChapterImages
                  .filter(img => {
                    // Explicit Top
                    if (slotIndex === 0 && img.position === 'top') return true;
                    // Explicit Bottom
                    if (slotIndex === paras.length && img.position === 'bottom') return true;
                    // Middle / Default position: place at paragraphIndex or midIndex
                    const targetIndex = img.paragraphIndex !== undefined ? img.paragraphIndex : Math.max(1, Math.floor(paras.length / 2));
                    if ((img.position === 'middle' || !img.position) && targetIndex === slotIndex) return true;
                    // Fallback for top/bottom if slot out of range
                    if (img.position === 'top' && slotIndex === 0) return true;
                    if (img.position === 'bottom' && slotIndex === paras.length) return true;
                    return false;
                  })
                  .map(img => (
                    <div key={img.id} className={`image-card-wrapper align-${img.align || 'center'}`}>
                      {renderImageCard(img, paras.length)}
                    </div>
                  ));
              };

              return (
                <>
                  {/* Top Images (Slot 0) */}
                  {renderImagesForSlot(0)}

                  {/* Paragraph Textareas and Middle Images */}
                  {paras.map((paraText, idx) => (
                    <React.Fragment key={idx}>
                      <textarea
                        className="editor-textarea paragraph-textarea"
                        placeholder={idx === 0 ? "Start writing your chapter here..." : "Continue writing..."}
                        value={paraText}
                        onChange={(e) => {
                          const updatedParas = [...paras];
                          updatedParas[idx] = e.target.value;
                          handleTextChange(updatedParas.join('\n\n'));
                        }}
                        onKeyDown={handleKeyDown}
                        onDrop={(e) => e.preventDefault()}
                        onDragOver={(e) => e.preventDefault()}
                      />
                      {/* Images in the Middle after this paragraph */}
                      {renderImagesForSlot(idx + 1)}
                    </React.Fragment>
                  ))}
                </>
              );
            })()}

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

          {/* Custom Typing Prompt Box */}
          <div className="prompt-typing-container">
            <div className="prompt-input-wrapper">
              <input
                type="text"
                className="prompt-input-field"
                placeholder="Ask AI for custom feedback..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCustomPrompt()}
              />
              <button
                className="prompt-send-btn"
                disabled={!customPrompt.trim() || suggestionsLoading}
                onClick={() => handleSendCustomPrompt()}
                title="Ask AI"
              >
                <Send size={14} />
              </button>
            </div>
            <div className="prompt-chips-wrapper">
              <span className="prompt-chip" onClick={() => handleSendCustomPrompt('Give plot twist ideas')}>✨ Twist</span>
              <span className="prompt-chip" onClick={() => handleSendCustomPrompt('Improve dialogue tone')}>💬 Dialogue</span>
              <span className="prompt-chip" onClick={() => handleSendCustomPrompt('Add sensory details')}>🌿 Sensory</span>
              <span className="prompt-chip" onClick={() => handleSendCustomPrompt('Check pacing and flow')}>⚡ Pacing</span>
            </div>
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

      {/* Image Upload Modal Dialog */}
      {showImageModal && (
        <div className="image-modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="image-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-header">
              <span style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image size={18} style={{ color: 'var(--accent-primary)' }} />
                Insert Illustration / Image
              </span>
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowImageModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="image-modal-body">
              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                <button
                  className="reader-tool-btn"
                  style={{
                    background: imageTab === 'upload' ? 'rgba(99,102,241,0.2)' : 'transparent',
                    borderColor: imageTab === 'upload' ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    color: imageTab === 'upload' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                  }}
                  onClick={() => setImageTab('upload')}
                >
                  <Upload size={14} /> Upload File
                </button>
                <button
                  className="reader-tool-btn"
                  style={{
                    background: imageTab === 'url' ? 'rgba(99,102,241,0.2)' : 'transparent',
                    borderColor: imageTab === 'url' ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    color: imageTab === 'url' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                  }}
                  onClick={() => setImageTab('url')}
                >
                  <LinkIcon size={14} /> Image Link / URL
                </button>
              </div>

              {/* Caption Input */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Caption / Title (Optional)
                </label>
                <input
                  type="text"
                  className="prompt-input-field"
                  style={{ width: '100%', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                  placeholder="e.g. Map of the Eastern Kingdom"
                  value={imageCaptionInput}
                  onChange={(e) => setImageCaptionInput(e.target.value)}
                />
              </div>

              {imageTab === 'upload' ? (
                <label className="image-dropzone">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                    disabled={uploadingImage}
                  />
                  {uploadingImage ? (
                    <div style={{ color: 'var(--accent-primary)', fontSize: '0.9rem' }}>
                      <Sparkles className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
                      Uploading image...
                    </div>
                  ) : (
                    <div>
                      <Upload size={28} style={{ color: 'var(--accent-primary)', margin: '0 auto 8px' }} />
                      <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>Click to select picture from computer</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNG, JPG, WEBP, GIF supported</p>
                    </div>
                  )}
                </label>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Image Web URL
                    </label>
                    <input
                      type="text"
                      className="prompt-input-field"
                      style={{ width: '100%', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                      placeholder="https://images.unsplash.com/photo-..."
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                    />
                  </div>
                  <button
                    className="confirm-btn"
                    style={{ justifyContent: 'center' }}
                    disabled={!imageUrlInput.trim()}
                    onClick={() => handleInsertImageMark(imageUrlInput.trim(), imageCaptionInput)}
                  >
                    Insert Image Link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Publish & Share Success Popup Modal */}
      {showPublishModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '24px'
        }}>
          <div style={{
            background: 'var(--bg-card, #161927)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '520px',
            padding: '36px 32px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            position: 'relative',
            color: 'var(--text-primary, #fff)',
            textAlign: 'center'
          }}>
            <button
              onClick={() => setShowPublishModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                borderRadius: '999px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: '8px' }}>
              Your Story Link is Live!
            </h2>
            <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>
              Readers visiting this link will see your published manuscript in clean public reader mode without editing tools.
            </p>

            {/* Published Link Input Box */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-secondary, #0d0f17)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
              borderRadius: '14px',
              padding: '10px 14px',
              marginBottom: '24px'
            }}>
              <input
                readOnly
                value={`${window.location.origin}/read/${bookId}`}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-emerald, #10b981)',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  outline: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/read/${bookId}`);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 3000);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: copiedLink ? '#10b981' : 'var(--accent-primary, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowPublishModal(false);
                  if (onViewPublished) onViewPublished();
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'var(--accent-primary, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Eye size={18} /> Open Published Reader
              </button>
              <button
                onClick={() => setShowPublishModal(false)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                  color: 'var(--text-secondary, #94a3b8)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
