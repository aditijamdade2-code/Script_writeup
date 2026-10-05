require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const writerRouter = require('./routes/writer');

const fs = require('fs');

const uploadsPath = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsPath)) {
  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
  } catch (err) {
    console.error('Failed to create uploads directory:', err);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/writer', writerRouter);

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

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(` [Backend Server] Listening on http://localhost:${PORT}`);
    console.log(` - Writer API: http://localhost:${PORT}/api/writer`);
    console.log(`===========================================`);
  });
}

module.exports = app;

