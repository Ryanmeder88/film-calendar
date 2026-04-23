import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const OMDB_KEY   = process.env.OMDB_API_KEY;

if (!TMDB_TOKEN) console.warn('Warning: TMDB_ACCESS_TOKEN not set');
if (!OMDB_KEY)   console.warn('Warning: OMDB_API_KEY not set');

const distPath = join(__dirname, 'dist');
console.log(`Serving static files from: ${distPath} (exists: ${existsSync(distPath)})`);

// Proxy /tmdb-api/* → https://api.themoviedb.org/3/*
// Express strips the /tmdb-api prefix before passing to the middleware,
// so we put /3 in the target directly — no pathRewrite needed.
app.use('/tmdb-api', createProxyMiddleware({
  target: 'https://api.themoviedb.org/3',
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('Authorization', `Bearer ${TMDB_TOKEN}`);
    },
  },
}));

// Proxy /omdb-api → http://www.omdbapi.com
// Express strips /omdb-api, leaving /?i=tt1234567 — just append the key.
app.use('/omdb-api', createProxyMiddleware({
  target: 'http://www.omdbapi.com',
  changeOrigin: true,
  pathRewrite: (path) => path + `&apikey=${OMDB_KEY}`,
}));

// Serve Vite build output
app.use(express.static(distPath));

// SPA fallback — send index.html for all unmatched routes
app.use((_req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Film Calendar running on port ${PORT}`);
});
