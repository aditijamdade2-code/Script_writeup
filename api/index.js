let app;
let initError = null;

try {
  app = require('../server/index');
} catch (err) {
  initError = err;
  console.error('Server initialization error:', err);
}

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      error: 'Server Initialization Failed',
      message: initError.message,
      stack: initError.stack
    });
  }
  return app(req, res);
};
