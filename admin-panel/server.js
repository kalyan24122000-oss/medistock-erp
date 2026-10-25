// admin-panel/server.js
// Dedicated standalone launcher for MediStock Licensing Authority Admin Panel

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.ADMIN_PORT || 5050;
const ADMIN_DIR = __dirname;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(ADMIN_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` MediStock Licensing Authority Admin Panel (Standalone) `);
  console.log(` URL: http://localhost:${PORT}                          `);
  console.log(` Target Licensing Backend: ${BACKEND_URL}              `);
  console.log(`=======================================================`);

  // Open default browser on Windows
  if (process.platform === 'win32') {
    exec(`start http://localhost:${PORT}`);
  }
});
