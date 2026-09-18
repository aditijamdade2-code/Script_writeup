import React, { useState, useEffect } from 'react';
import WriterBookshelf from './apps/writer/WriterBookshelf';
import WriterEditor from './apps/writer/WriterEditor';
import ReaderBookshelf from './apps/reader/ReaderBookshelf';
import ReaderView from './apps/reader/ReaderView';

import './styles/index.css';
import './styles/writer.css';
import './styles/reader.css';

export default function App() {
  // Parse path on initial render & listen to popstate
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [readerTheme, setReaderTheme] = useState('sepia');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Route matching logic
  if (currentPath.startsWith('/writer/book/')) {
    const bookId = currentPath.replace('/writer/book/', '');
    return (
      <WriterEditor
        bookId={bookId}
        onBackToBookshelf={() => navigateTo('/writer')}
        onOpenReader={(bId) => navigateTo(`/read/${bId || bookId}`)}
      />
    );
  }

  if (currentPath.startsWith('/read/') || currentPath.startsWith('/reader/book/')) {
    const bookId = currentPath.replace(/\/read\/|\/reader\/book\//, '');
    return (
      <ReaderView
        bookId={bookId}
        onBackToBookshelf={() => navigateTo('/reader')}
        theme={readerTheme}
        setTheme={setReaderTheme}
      />
    );
  }

  if (currentPath.startsWith('/reader')) {
    return (
      <ReaderBookshelf
        onSelectBook={(bookId) => navigateTo(`/read/${bookId}`)}
        theme={readerTheme}
        setTheme={setReaderTheme}
      />
    );
  }

  // Default: Writer Bookshelf (`/writer` or `/`)
  return (
    <WriterBookshelf
      onSelectBook={(bookId) => navigateTo(`/writer/book/${bookId}`)}
      onOpenReader={(bookId) => navigateTo(bookId ? `/read/${bookId}` : '/reader')}
    />
  );
}
