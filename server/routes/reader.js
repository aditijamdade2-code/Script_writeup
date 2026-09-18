const express = require('express');
const db = require('../db');

const router = express.Router();

// 1. GET /api/reader/books - List all books with published chapters
router.get('/books', (req, res) => {
  try {
    const books = db.prepare(`
      SELECT b.id, b.title, b.created_at,
             COUNT(c.id) as published_page_count,
             MAX(c.updated_at) as last_updated
      FROM books b
      JOIN chapters c ON b.id = c.book_id
      WHERE c.published = 1
      GROUP BY b.id
      HAVING published_page_count > 0
      ORDER BY b.created_at DESC
    `).all();

    res.json({ books });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/reader/books/:id - Get book and only its published chapters (read-only)
router.get('/books/:id', (req, res) => {
  try {
    const book = db.prepare('SELECT id, title, created_at FROM books WHERE id = ?').get(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // STRICT: Only published chapters; omit 'suggestions' and drafts
    const chapters = db.prepare(`
      SELECT id, book_id, title, text, "order", updated_at
      FROM chapters
      WHERE book_id = ? AND published = 1
      ORDER BY "order" ASC, updated_at ASC
    `).all(req.params.id);

    res.json({
      book,
      chapters
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guard: Strictly reject any mutation requests on Reader API
router.use((req, res) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      error: 'Method Not Allowed. Reader API is strictly read-only.'
    });
  }
  res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = router;
