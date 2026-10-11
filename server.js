const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 10000;

// Enable gzip compression for fast asset delivery
app.use(compression());

// Serve static frontend files
app.use(express.static(path.join(__dirname), {
  maxAge: '1h',
  etag: true
}));

// Health check endpoint for Render service monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// Fallback to index.html for Single Page Application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 In-Store Activation Portal running on port ${PORT}`);
  console.log(`🔗 Ready for Render deployment with Firebase integration`);
});
