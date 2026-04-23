import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const OMDB_KEY   = process.env.OMDB_API_KEY;

if (!TMDB_TOKEN) console.warn('Warning: TMDB_ACCESS_TOKEN not set');
if (!OMDB_KEY)   console.warn('Warning: OMDB_API_KEY not set');

// Proxy /tmdb-api → https://api.themoviedb.org/3
app.use('/tmdb-api', createProxyMiddleware({
  target: 'https://api.themoviedb.org',
  changeOrigin: true,
  pathRewrite: { '^/tmdb-api': '/3' },
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('Authorization', `Bearer ${TMDB_TOKEN}`);
    },
  },
}));

// Proxy /omdb-api → http://www.omdbapi.com
app.use('/omdb-api', createProxyMiddleware({
  target: 'http://www.omdbapi.com',
  changeOrigin: true,
  pathRewrite: (path) => path.replace(/^\/omdb-api/, '') + `&apikey=${OMDB_KEY}`,
}));

// Serve Vite build output
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback — all other routes serve index.html
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Film Calendar running on port ${PORT}`);
});
