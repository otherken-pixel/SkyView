/**
 * Minimal static-file server for Firebase App Hosting.
 * Serves the pre-built FlightScore app from the public/ directory.
 * Falls back to public/index.html for all unknown paths (SPA routing).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain',
};

function serveIndex(res) {
  fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    }
  });
}

const server = http.createServer((req, res) => {
  // Strip query strings and decode URI components
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Resolve to an absolute path inside PUBLIC_DIR
  const filePath = path.resolve(PUBLIC_DIR, '.' + urlPath);

  // Security: prevent path traversal outside of PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // File not found — fall back to index.html for SPA routing
      serveIndex(res);
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`FlightScore App Hosting server listening on port ${PORT}`);
});
