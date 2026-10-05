import React, { useState, useEffect } from 'react';
import WriterBookshelf from './apps/writer/WriterBookshelf';
import WriterEditor from './apps/writer/WriterEditor';

import './styles/index.css';
import './styles/writer.css';

export default function App() {
  // Parse path on initial render & listen to popstate
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

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
        onBackToBookshelf={() => navigateTo('/')}
      />
    );
  }

  // Default: Writer Bookshelf (`/writer` or `/`)
  return (
    <WriterBookshelf
      onSelectBook={(bookId) => navigateTo(`/writer/book/${bookId}`)}
    />
  );
}

