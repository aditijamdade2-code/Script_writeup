const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { generateSuggestions } = require('../ai');

const router = express.Router();

// Helper to parse suggestions JSON safely
function parseChapter(chapter) {
  if (!chapter) return null;
  return {
    ...chapter,
    published: Boolean(chapter.published),
    suggestions: chapter.suggestions ? JSON.parse(chapter.suggestions) : null
  };
}

// 1. GET /api/writer/books - List all books with chapter counts
router.get('/books', (req, res) => {
  try {
    const books = db.prepare(`
      SELECT b.id, b.title, b.created_at,
             COUNT(c.id) as page_count,
             SUM(CASE WHEN c.published = 1 THEN 1 ELSE 0 END) as published_page_count,
             MAX(c.updated_at) as last_updated
      FROM books b
      LEFT JOIN chapters c ON b.id = c.book_id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `).all();

    res.json({ books });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/writer/books - Create a new book with starter "Chapter one"
router.post('/books', (req, res) => {
  try {
    const { title } = req.body;
    const bookTitle = (title && title.trim()) || 'Untitled Book';
    const bookId = uuidv4();
    const chapterId = uuidv4();

    const insertBook = db.prepare('INSERT INTO books (id, title, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, book_id, title, text, "order", published, suggestions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const createTransaction = db.transaction(() => {
      insertBook.run(bookId, bookTitle);
      insertChapter.run(
        chapterId,
        bookId,
        'Chapter one',
        '',
        0,
        1, // published by default
        null
      );
    });

    createTransaction();

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);

    res.status(201).json({
      book,
      firstChapterId: chapterId,
      chapters: [parseChapter(chapter)]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/writer/books/:id - Get book and all its chapters
router.get('/books/:id', (req, res) => {
  try {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const rawChapters = db.prepare(`
      SELECT * FROM chapters
      WHERE book_id = ?
      ORDER BY "order" ASC, updated_at ASC
    `).all(req.params.id);

    const chapters = rawChapters.map(parseChapter);

    res.json({ book, chapters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. PUT /api/writer/books/:id - Update book title
router.put('/books/:id', (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = db.prepare('UPDATE books SET title = ? WHERE id = ?').run(title.trim(), req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const updatedBook = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    res.json({ book: updatedBook });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DELETE /api/writer/books/:id - Delete book
router.delete('/books/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json({ success: true, message: 'Book deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/writer/books/:bookId/chapters - Add new chapter/page
router.post('/books/:bookId/chapters', (req, res) => {
  try {
    const { bookId } = req.params;
    const { title, text, published } = req.body || {};

    const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Determine next order sequence
    const maxOrderRow = db.prepare('SELECT MAX("order") as max_order FROM chapters WHERE book_id = ?').get(bookId);
    const nextOrder = (maxOrderRow && maxOrderRow.max_order !== null) ? maxOrderRow.max_order + 1 : 0;

    const chapterId = uuidv4();
    const chapterTitle = (title && title.trim()) || `Chapter ${nextOrder + 1}`;
    const chapterText = text || '';
    const isPublished = published !== undefined ? (published ? 1 : 0) : 1;

    db.prepare(`
      INSERT INTO chapters (id, book_id, title, text, "order", published, suggestions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)
    `).run(chapterId, bookId, chapterTitle, chapterText, nextOrder, isPublished);

    const newChapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);
    res.status(201).json({ chapter: parseChapter(newChapter) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. PUT /api/writer/chapters/:id - Update chapter title, text, published, or order
router.put('/chapters/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM chapters WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const title = req.body.title !== undefined ? req.body.title : existing.title;
    const text = req.body.text !== undefined ? req.body.text : existing.text;
    const published = req.body.published !== undefined ? (req.body.published ? 1 : 0) : existing.published;
    const order = req.body.order !== undefined ? req.body.order : existing.order;

    db.prepare(`
      UPDATE chapters
      SET title = ?, text = ?, published = ?, "order" = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, text, published, order, id);

    const updated = db.prepare('SELECT * FROM chapters WHERE id = ?').get(id);
    res.json({ chapter: parseChapter(updated) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. DELETE /api/writer/chapters/:id - Delete chapter (disabled if only 1 remaining)
router.delete('/chapters/:id', (req, res) => {
  try {
    const { id } = req.params;
    const chapter = db.prepare('SELECT book_id FROM chapters WHERE id = ?').get(id);
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const countRow = db.prepare('SELECT COUNT(*) as count FROM chapters WHERE book_id = ?').get(chapter.book_id);
    if (countRow.count <= 1) {
      return res.status(400).json({
        error: 'Cannot delete the only remaining chapter in a book. A book must have at least one chapter.'
      });
    }

    db.prepare('DELETE FROM chapters WHERE id = ?').run(id);

    // Re-index remaining chapters in order
    const remaining = db.prepare('SELECT id FROM chapters WHERE book_id = ? ORDER BY "order" ASC').all(chapter.book_id);
    const updateOrderStmt = db.prepare('UPDATE chapters SET "order" = ? WHERE id = ?');
    const reindexTx = db.transaction(() => {
      remaining.forEach((row, index) => {
        updateOrderStmt.run(index, row.id);
      });
    });
    reindexTx();

    res.json({ success: true, message: 'Chapter deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. POST /api/writer/chapters/:id/suggestions - Generate and save AI suggestions
router.post('/chapters/:id/suggestions', async (req, res) => {
  try {
    const { id } = req.params;
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(id);
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    // Use current DB text or text passed in body
    const title = req.body.title !== undefined ? req.body.title : chapter.title;
    const text = req.body.text !== undefined ? req.body.text : chapter.text;
    const customPrompt = req.body.customPrompt !== undefined ? req.body.customPrompt : null;

    // Generate suggestions
    const suggestionsArray = await generateSuggestions(title, text, customPrompt);
    const suggestionsJson = JSON.stringify(suggestionsArray);

    // Save to DB
    db.prepare(`
      UPDATE chapters
      SET suggestions = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(suggestionsJson, id);

    res.json({
      success: true,
      chapterId: id,
      suggestions: suggestionsArray
    });
  } catch (err) {
    console.error('Error generating suggestions:', err);
    res.status(500).json({ error: 'Failed to generate suggestions. Please try again.' });
  }
});

// 10. POST /api/writer/upload-image - Upload base64 image and save to disk
const fs = require('fs');
const path = require('path');

router.post('/upload-image', (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    let ext = 'png';
    let base64Data = imageBase64;

    if (matches) {
      ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      base64Data = matches[2];
    }

    const uniqueName = `img_${uuidv4().slice(0, 8)}.${ext}`;
    const uploadsDir = path.join(__dirname, '../..', 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, uniqueName);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    res.json({
      success: true,
      url: `/uploads/${uniqueName}`
    });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;
