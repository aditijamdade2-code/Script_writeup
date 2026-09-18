require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const writerRouter = require('./routes/writer');
const readerRouter = require('./routes/reader');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/writer', writerRouter);
app.use('/api/reader', readerRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiEngine: process.env.ANTHROPIC_API_KEY ? 'Claude API' : 'Built-in Literary Critique Engine'
  });
});

// Serve frontend build in production if available
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routes in production
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) {
      res.status(200).send('API Server is running.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(` [Backend Server] Listening on http://localhost:${PORT}`);
  console.log(` - Writer API: http://localhost:${PORT}/api/writer`);
  console.log(` - Reader API: http://localhost:${PORT}/api/reader`);
  console.log(`===========================================`);
});
