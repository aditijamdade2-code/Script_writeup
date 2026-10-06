const app = require('../server/index');

module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (err) {
    console.error('Vercel Serverless Function Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};
