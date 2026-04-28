import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_TOKEN    = process.env.TMDB_ACCESS_TOKEN;
const OMDB_KEY      = process.env.OMDB_API_KEY;
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!TMDB_TOKEN)    console.warn('Warning: TMDB_ACCESS_TOKEN not set');
if (!OMDB_KEY)      console.warn('Warning: OMDB_API_KEY not set');
if (!UPSTASH_URL)   console.warn('Warning: UPSTASH_REDIS_REST_URL not set — agent scores unavailable');

// Upstash Redis helpers
async function upstashGet(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', key]),
    });
    const { result } = await res.json();
    return result ? JSON.parse(result) : null;
  } catch {
    return null;
  }
}

async function upstashSet(key, value, ttlSeconds) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)]),
    });
  } catch {
    // Non-fatal — cache write failure shouldn't break the response
  }
}

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

// OMDB with Upstash cache — persists across server restarts (Render spin-downs).
// Each IMDb ID is fetched from OMDB at most once per 24 hours.
const OMDB_TTL = 24 * 60 * 60; // 24 hours in seconds

app.get('/omdb-api', async (req, res) => {
  const id = req.query.i;
  if (!id) return res.status(400).json({ Response: 'False', Error: 'Missing ?i= parameter' });

  // Check Upstash for cached OMDB response (survives server restarts)
  const cached = await upstashGet(`omdb:${id}`);
  if (cached) return res.json(cached);

  try {
    // Fetch agent scores and OMDB data in parallel
    const [agent, upstream] = await Promise.all([
      upstashGet(`rt:${id}`),
      fetch(`http://www.omdbapi.com/?i=${encodeURIComponent(id)}&apikey=${OMDB_KEY}`),
    ]);
    const data = await upstream.json();

    if (data.Response === 'True') {
      // Inject any agent scores OMDB is missing
      const hasRtScore   = data.Ratings?.some(r => r.Source === 'Rotten Tomatoes');
      const hasMetascore = data.Metascore && data.Metascore !== 'N/A';
      if (agent) {
        if (!hasRtScore && agent.tomatometer != null) {
          if (!data.Ratings) data.Ratings = [];
          data.Ratings.push({ Source: 'Rotten Tomatoes', Value: `${agent.tomatometer}%` });
          if (agent.audienceScore != null) data._rtAudienceScore = `${agent.audienceScore}%`;
        }
        if (!hasMetascore && agent.metascore != null) {
          data.Metascore = String(agent.metascore);
        }
      }
      await upstashSet(`omdb:${id}`, data, OMDB_TTL);
      return res.json(data);
    }

    // OMDB failed (rate limit, unknown ID, etc.) — return agent scores if we have them
    if (agent?.tomatometer != null || agent?.metascore != null) {
      const agentData = { Response: 'True', Ratings: [], Metascore: 'N/A' };
      if (agent.tomatometer != null) {
        agentData.Ratings.push({ Source: 'Rotten Tomatoes', Value: `${agent.tomatometer}%` });
        if (agent.audienceScore != null) agentData._rtAudienceScore = `${agent.audienceScore}%`;
      }
      if (agent.metascore != null) agentData.Metascore = String(agent.metascore);
      await upstashSet(`omdb:${id}`, agentData, OMDB_TTL);
      return res.json(agentData);
    }

    res.json(data);
  } catch (err) {
    res.status(502).json({ Response: 'False', Error: 'Upstream fetch failed' });
  }
});

// Serve Vite build output
app.use(express.static(distPath));

// SPA fallback — send index.html for all unmatched routes
app.use((_req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Film Calendar running on port ${PORT}`);
});
