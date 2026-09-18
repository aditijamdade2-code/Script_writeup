const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for reliability and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    suggestions TEXT, -- JSON array string of [{ quote, note }]
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
  CREATE INDEX IF NOT EXISTS idx_chapters_order ON chapters("order");
`);

// Seed initial sample book if empty
const countBooks = db.prepare('SELECT COUNT(*) as count FROM books').get();
if (countBooks.count === 0) {
  const sampleBookId = uuidv4();
  const insertBook = db.prepare('INSERT INTO books (id, title, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  const insertChapter = db.prepare(`
    INSERT INTO chapters (id, book_id, title, text, "order", published, suggestions, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  insertBook.run(sampleBookId, 'The Clockmaker of Vienna');

  const chapter1Id = uuidv4();
  const chapter1Text = `The clock shop smelled of aged cedar, mineral oil, and the quiet weight of three centuries of unhurried minutes.

Master Kaspar leaned over his brass workbench, his magnifying loupe pressed tightly against his brow. Through the curved crystal lens, a miniature escapement wheel gleamed like a captive constellation. Outside, the cobblestones of the old quarter glistened under a sudden October drizzle, muffling the clip-clop of passing carriage horses.

"Listen closely," Kaspar whispered to his young apprentice, never lifting his eyes from the gear teeth. "A true timepiece does not merely measure the passage of hours. It records the heartbeat of the room it inhabits."

Lukas stepped forward, holding his breath as if a single stray exhale might shatter the balance spring. On the shelf behind them, ninety-two clocks ticked in near-perfect synchronization—a symphony of patient brass and ticking pendulums.`;

  const chapter1Suggestions = JSON.stringify([
    {
      quote: "aged cedar, mineral oil",
      note: "Rich sensory opening that immediately grounds the workshop atmosphere."
    },
    {
      quote: "captive constellation",
      note: "Vivid metaphor—enhances the sense of microscopic artistry."
    },
    {
      quote: "ninety-two clocks ticked in near-perfect synchronization",
      note: "Strong auditory detail building quiet anticipation."
    }
  ]);

  insertChapter.run(
    chapter1Id,
    sampleBookId,
    'Chapter One: The Golden Escapement',
    chapter1Text,
    0,
    1,
    chapter1Suggestions
  );

  const chapter2Id = uuidv4();
  const chapter2Text = `By midnight, the storm had deepened, hurling sheets of cold rain against the high arched windows.

A sharp, deliberate knock rattled the heavy oak door. Three taps, followed by two shorter pulses. Lukas jumped, dropping a brass screw into the velvet tray.

"Don't open it yet," Kaspar murmured, his voice suddenly taut. He wiped his tweezers on a linen cloth and walked toward the iron-bound chest beneath the workbench. From inside, he drew a small velvet pouch bound with crimson thread.`;

  insertChapter.run(
    chapter2Id,
    sampleBookId,
    'Chapter Two: The Midnight Visitor',
    chapter2Text,
    1,
    1,
    null
  );

  const chapter3Id = uuidv4();
  const chapter3Text = `The stranger wore a charcoal cloak beaded with rain. His fingers were long and slender, tipped with silver-capped rings that clinked against the counter.

(This chapter is currently in draft mode and will not appear in the Reader app until published.)`;

  insertChapter.run(
    chapter3Id,
    sampleBookId,
    'Chapter Three: An Unexpected Proposal (Draft)',
    chapter3Text,
    2,
    0, // Draft mode
    null
  );
}

module.exports = db;
