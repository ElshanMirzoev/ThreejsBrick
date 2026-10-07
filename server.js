// Локальный HTTP-сервер для 100% автономной работы без интернета
// Не требует установки npm-пакетов (использует встроенные модули Node.js)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DEFAULT_PORT = 5500;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.exr': 'image/x-exr',
  '.hdr': 'image/vnd.radiance'
};

const os = require('os');

function getAllLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

function startServer(port) {
  const server = http.createServer((req, res) => {
    let reqUrl = decodeURI(req.url.split('?')[0]);
    if (reqUrl === '/' || reqUrl === '') {
      reqUrl = '/index.html';
    }

    const safePath = path.normalize(path.join(ROOT_DIR, reqUrl));
    if (!safePath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 Forbidden');
    }

    fs.stat(safePath, (err, stats) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(`404 Not Found: ${reqUrl}`);
      }

      let filePath = safePath;
      if (stats.isDirectory()) {
        filePath = path.join(safePath, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end(`500 Internal Server Error`);
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(content);
      });
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[ИНФО] Порт ${port} занят, пробуем порт ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[ОШИБКА]', err);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const localUrl = `http://localhost:${port}/index.html`;
    const ips = getAllLocalIPs();

    console.log('====================================================');
    console.log('  ЛОКАЛЬНЫЙ СЕРВЕР ЗАПУЩЕН (100% БЕЗ ИНТЕРНЕТА)');
    console.log(`  На ноутбуке:  ${localUrl}`);
    console.log('  ----------------------------------------------------');
    console.log('  ДЛЯ ПОКАЗА НА ТЕЛЕФОНЕ (в одном Wi-Fi или Hotspot):');
    if (ips.length > 0) {
      ips.forEach(({ name, address }) => {
        console.log(`  -> http://${address}:${port}/index.html  (${name})`);
      });
    } else {
      console.log(`  -> http://192.168.0.141:${port}/index.html`);
    }
    console.log('====================================================');
    console.log('  Для завершения нажмите Ctrl + C');

    // Автоматическое открытие в браузере
    if (!process.env.NO_OPEN && !process.argv.includes('--no-open')) {
      const startCmd = process.platform === 'win32' ? `start "" "${localUrl}"` : `open "${localUrl}"`;
      exec(startCmd, (e) => {
        if (e) console.log(`Откройте в браузере вручную: ${localUrl}`);
      });
    }
  });
}

startServer(DEFAULT_PORT);
