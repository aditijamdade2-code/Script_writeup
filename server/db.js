const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

let db;
let isFallback = false;

if (process.env.VERCEL || process.env.NOW_BUILDER) {
  isFallback = true;
} else {
  try {
    const req = eval('require');
    const Database = req('better-sqlite3');
    let dbPath = path.join(__dirname, '..', 'data.sqlite');
    db = new Database(dbPath);
    try {
      db.pragma('journal_mode = WAL');
    } catch (e) {}
    if (!isFallback) {
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
          suggestions TEXT,
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
        const chapter1Text = `The clock shop smelled of aged cedar, mineral oil, and the quiet weight of three centuries of unhurried minutes.\n\nMaster Kaspar leaned over his brass workbench, his magnifying loupe pressed tightly against his brow. Through the curved crystal lens, a miniature escapement wheel gleamed like a captive constellation. Outside, the cobblestones of the old quarter glistened under a sudden October drizzle, muffling the clip-clop of passing carriage horses.\n\n"Listen closely," Kaspar whispered to his young apprentice, never lifting his eyes from the gear teeth. "A true timepiece does not merely measure the passage of hours. It records the heartbeat of the room it inhabits."\n\nLukas stepped forward, holding his breath as if a single stray exhale might shatter the balance spring. On the shelf behind them, ninety-two clocks ticked in near-perfect synchronization—a symphony of patient brass and ticking pendulums.`;

        const chapter1Suggestions = JSON.stringify([
          { quote: "aged cedar, mineral oil", note: "Rich sensory opening that immediately grounds the workshop atmosphere." },
          { quote: "captive constellation", note: "Vivid metaphor—enhances the sense of microscopic artistry." },
          { quote: "ninety-two clocks ticked in near-perfect synchronization", note: "Strong auditory detail building quiet anticipation." }
        ]);

        insertChapter.run(chapter1Id, sampleBookId, 'Chapter One: The Golden Escapement', chapter1Text, 0, 1, chapter1Suggestions);

        const chapter2Id = uuidv4();
        const chapter2Text = `By midnight, the storm had deepened, hurling sheets of cold rain against the high arched windows.\n\nA sharp, deliberate knock rattled the heavy oak door. Three taps, followed by two shorter pulses. Lukas jumped, dropping a brass screw into the velvet tray.\n\n"Don't open it yet," Kaspar murmured, his voice suddenly taut. He wiped his tweezers on a linen cloth and walked toward the iron-bound chest beneath the workbench. From inside, he drew a small velvet pouch bound with crimson thread.`;
        insertChapter.run(chapter2Id, sampleBookId, 'Chapter Two: The Midnight Visitor', chapter2Text, 1, 1, null);

        const chapter3Id = uuidv4();
        const chapter3Text = `The stranger wore a charcoal cloak beaded with rain. His fingers were long and slender, tipped with silver-capped rings that clinked against the counter.\n\n(This chapter is currently in draft mode and will not appear in the Reader app until published.)`;
        insertChapter.run(chapter3Id, sampleBookId, 'Chapter Three: An Unexpected Proposal (Draft)', chapter3Text, 2, 0, null);
      }
    }
  } catch (err) {
    console.warn('better-sqlite3 unavailable, using in-memory database fallback:', err.message);
    isFallback = true;
  }
}

if (isFallback) {
  const sampleBookId = 'sample-book-1';
  const chapter1Id = 'sample-ch-1';
  const chapter2Id = 'sample-ch-2';
  const chapter3Id = 'sample-ch-3';

  const memoryStore = {
    books: [
      { id: sampleBookId, title: 'The Clockmaker of Vienna', created_at: new Date().toISOString() }
    ],
    chapters: [
      {
        id: chapter1Id,
        book_id: sampleBookId,
        title: 'Chapter One: The Golden Escapement',
        text: `The clock shop smelled of aged cedar, mineral oil, and the quiet weight of three centuries of unhurried minutes.\n\nMaster Kaspar leaned over his brass workbench, his magnifying loupe pressed tightly against his brow. Through the curved crystal lens, a miniature escapement wheel gleamed like a captive constellation. Outside, the cobblestones of the old quarter glistened under a sudden October drizzle, muffling the clip-clop of passing carriage horses.\n\n"Listen closely," Kaspar whispered to his young apprentice, never lifting his eyes from the gear teeth. "A true timepiece does not merely measure the passage of hours. It records the heartbeat of the room it inhabits."\n\nLukas stepped forward, holding his breath as if a single stray exhale might shatter the balance spring. On the shelf behind them, ninety-two clocks ticked in near-perfect synchronization—a symphony of patient brass and ticking pendulums.`,
        order: 0,
        published: 1,
        suggestions: JSON.stringify([
          { quote: "aged cedar, mineral oil", note: "Rich sensory opening that immediately grounds the workshop atmosphere." },
          { quote: "captive constellation", note: "Vivid metaphor—enhances the sense of microscopic artistry." }
        ]),
        updated_at: new Date().toISOString()
      },
      {
        id: chapter2Id,
        book_id: sampleBookId,
        title: 'Chapter Two: The Midnight Visitor',
        text: `By midnight, the storm had deepened, hurling sheets of cold rain against the high arched windows.\n\nA sharp, deliberate knock rattled the heavy oak door. Three taps, followed by two shorter pulses. Lukas jumped, dropping a brass screw into the velvet tray.\n\n"Don't open it yet," Kaspar murmured, his voice suddenly taut. He wiped his tweezers on a linen cloth and walked toward the iron-bound chest beneath the workbench. From inside, he drew a small velvet pouch bound with crimson thread.`,
        order: 1,
        published: 1,
        suggestions: null,
        updated_at: new Date().toISOString()
      },
      {
        id: chapter3Id,
        book_id: sampleBookId,
        title: 'Chapter Three: An Unexpected Proposal (Draft)',
        text: `The stranger wore a charcoal cloak beaded with rain. His fingers were long and slender, tipped with silver-capped rings that clinked against the counter.`,
        order: 2,
        published: 0,
        suggestions: null,
        updated_at: new Date().toISOString()
      }
    ]
  };

  db = {
    exec: () => {},
    pragma: () => {},
    transaction: (fn) => (...args) => fn(...args),
    prepare: (sql) => {
      const lowerSql = sql.toLowerCase();
      return {
        all: (...params) => {
          if (lowerSql.includes('from books')) {
            return memoryStore.books.map(b => {
              const chs = memoryStore.chapters.filter(c => c.book_id === b.id);
              const pubChs = chs.filter(c => c.published === 1);
              return {
                ...b,
                page_count: chs.length,
                published_page_count: pubChs.length,
                last_updated: chs.length ? chs[chs.length - 1].updated_at : b.created_at
              };
            });
          }
          if (lowerSql.includes('from chapters')) {
            const bookId = params[0];
            return memoryStore.chapters.filter(c => c.book_id === bookId);
          }
          return [];
        },
        get: (...params) => {
          if (lowerSql.includes('count(*) as count from books')) {
            return { count: memoryStore.books.length };
          }
          if (lowerSql.includes('from books where id = ?')) {
            return memoryStore.books.find(b => b.id === params[0]) || null;
          }
          if (lowerSql.includes('from chapters where id = ?')) {
            return memoryStore.chapters.find(c => c.id === params[0]) || null;
          }
          if (lowerSql.includes('max("order") as max_order')) {
            const bookId = params[0];
            const chs = memoryStore.chapters.filter(c => c.book_id === bookId);
            const maxOrder = chs.length ? Math.max(...chs.map(c => c.order)) : null;
            return { max_order: maxOrder };
          }
          if (lowerSql.includes('count(*) as count from chapters')) {
            const bookId = params[0];
            const chs = memoryStore.chapters.filter(c => c.book_id === bookId);
            return { count: chs.length };
          }
          return null;
        },
        run: (...params) => {
          if (lowerSql.includes('insert into books')) {
            memoryStore.books.push({ id: params[0], title: params[1], created_at: new Date().toISOString() });
            return { changes: 1 };
          }
          if (lowerSql.includes('insert into chapters')) {
            memoryStore.chapters.push({
              id: params[0],
              book_id: params[1],
              title: params[2],
              text: params[3] || '',
              order: params[4] || 0,
              published: params[5] !== undefined ? params[5] : 1,
              suggestions: params[6] || null,
              updated_at: new Date().toISOString()
            });
            return { changes: 1 };
          }
          if (lowerSql.includes('update books set title = ?')) {
            const b = memoryStore.books.find(b => b.id === params[1]);
            if (b) { b.title = params[0]; return { changes: 1 }; }
            return { changes: 0 };
          }
          if (lowerSql.includes('update chapters')) {
            const targetId = params[params.length - 1];
            const c = memoryStore.chapters.find(c => c.id === targetId);
            if (c) {
              if (lowerSql.includes('suggestions = ?')) {
                c.suggestions = params[0];
              } else {
                c.title = params[0];
                c.text = params[1];
                c.published = params[2];
                c.order = params[3];
              }
              c.updated_at = new Date().toISOString();
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          if (lowerSql.includes('delete from books')) {
            memoryStore.books = memoryStore.books.filter(b => b.id !== params[0]);
            memoryStore.chapters = memoryStore.chapters.filter(c => c.book_id !== params[0]);
            return { changes: 1 };
          }
          if (lowerSql.includes('delete from chapters')) {
            memoryStore.chapters = memoryStore.chapters.filter(c => c.id !== params[0]);
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }
  };
}

module.exports = db;
