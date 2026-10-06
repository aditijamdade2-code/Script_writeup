import React, { useState, useEffect } from 'react';
import WriterBookshelf from './apps/writer/WriterBookshelf';
import WriterEditor from './apps/writer/WriterEditor';
import PublishedReaderView from './apps/reader/PublishedReaderView';

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

  // Route: Public Published Book Reader (`/read/:bookId` or `/book/:bookId`)
  if (currentPath.startsWith('/read/') || currentPath.startsWith('/book/')) {
    const bookId = currentPath.replace('/read/', '').replace('/book/', '');
    return (
      <PublishedReaderView
        bookId={bookId}
        onBackToBookshelf={() => navigateTo('/')}
        onGoToEditor={() => navigateTo(`/writer/book/${bookId}`)}
      />
    );
  }

  // Route: Writer Editor (`/writer/book/:bookId` or `/edit/:bookId`)
  if (currentPath.startsWith('/writer/book/') || currentPath.startsWith('/edit/')) {
    const bookId = currentPath.replace('/writer/book/', '').replace('/edit/', '');
    return (
      <WriterEditor
        bookId={bookId}
        onBackToBookshelf={() => navigateTo('/')}
        onViewPublished={() => navigateTo(`/read/${bookId}`)}
      />
    );
  }

  // Default: Writer Bookshelf (`/writer` or `/`)
  return (
    <WriterBookshelf
      onSelectBook={(bookId) => navigateTo(`/writer/book/${bookId}`)}
      onViewPublished={(bookId) => navigateTo(`/read/${bookId}`)}
    />
  );
}

