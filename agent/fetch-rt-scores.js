/**
 * RT Score Agent
 * Runs nightly via GitHub Actions.
 * Finds films near release that are missing RT scores in our cache,
 * looks them up via Gemini (Google Search grounding), and stores in Upstash Redis.
 */

const TMDB_TOKEN    = process.env.TMDB_ACCESS_TOKEN;
const GEMINI_KEY    = process.env.GEMINI_API_KEY;
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!TMDB_TOKEN || !GEMINI_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Upstash REST helpers (no SDK needed)
// ---------------------------------------------------------------------------

async function redisCmd(...args) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Redis error: ${json.error}`);
  return json.result;
}

async function redisGet(key) {
  const result = await redisCmd('GET', key);
  return result ? JSON.parse(result) : null;
}

async function redisSet(key, value, ttlSeconds) {
  await redisCmd('SET', key, JSON.stringify(value), 'EX', String(ttlSeconds));
}

// ---------------------------------------------------------------------------
// TMDB helpers
// ---------------------------------------------------------------------------

async function tmdbGet(path) {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json();
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

// Films releasing within the embargo-lifted window:
// up to 7 days ago (may still be in early run) to 14 days from now
// (embargos typically lift 1–2 weeks before release).
async function getFilmsInWindow() {
  const today = new Date();
  const from  = new Date(today.getTime() - 7  * 86400000);
  const to    = new Date(today.getTime() + 14 * 86400000);

  const pages = await Promise.all([1, 2, 3].map(page =>
    tmdbGet(
      `/discover/movie?with_release_type=3&region=US` +
      `&release_date.gte=${dateStr(from)}&release_date.lte=${dateStr(to)}` +
      `&with_original_language=en&sort_by=popularity.desc&page=${page}`
    )
  ));

  return pages.flatMap(p => p.results ?? []);
}

// ---------------------------------------------------------------------------
// Gemini with Google Search grounding
// ---------------------------------------------------------------------------

async function queryGemini(title, year) {
  const prompt =
    `What are the current Rotten Tomatoes scores for the movie "${title}" (${year})? ` +
    `Reply in exactly this format and nothing else:\n` +
    `Tomatometer: [number or N/A]\n` +
    `Audience Score: [number or N/A]`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearchRetrieval: {} }],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return parseGeminiResponse(text);
}

function parseGeminiResponse(text) {
  const tomatoMatch   = text.match(/Tomatometer:\s*(\d+|N\/A)/i);
  const audienceMatch = text.match(/Audience Score:\s*(\d+|N\/A)/i);

  const tomatometer   = tomatoMatch?.[1]   === 'N/A' ? null : parseInt(tomatoMatch?.[1],   10) || null;
  const audienceScore = audienceMatch?.[1]  === 'N/A' ? null : parseInt(audienceMatch?.[1], 10) || null;

  return { tomatometer, audienceScore };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`RT Score Agent — ${new Date().toISOString()}`);

  const films = await getFilmsInWindow();
  console.log(`Films in window: ${films.length}`);

  let fetched = 0;
  let skipped = 0;
  let noScore = 0;

  for (const film of films) {
    const details = await tmdbGet(`/movie/${film.id}`);
    const imdbId  = details.imdb_id;
    if (!imdbId) { skipped++; continue; }

    const cacheKey = `rt:${imdbId}`;
    const existing = await redisGet(cacheKey);

    // Skip if we already have a real score cached
    if (existing?.tomatometer != null) {
      console.log(`  SKIP  ${film.title} — already ${existing.tomatometer}%`);
      skipped++;
      continue;
    }

    const year = film.release_date?.slice(0, 4) ?? '';
    console.log(`  FETCH ${film.title} (${year})...`);

    try {
      const { tomatometer, audienceScore } = await queryGemini(film.title, year);

      if (tomatometer !== null) {
        // Cache confirmed score for 7 days (scores don't change much once published)
        await redisSet(cacheKey, {
          tomatometer,
          audienceScore,
          source: 'agent',
          lastChecked: Date.now(),
        }, 7 * 24 * 60 * 60);
        console.log(`    ✓ Tomatometer: ${tomatometer}%${audienceScore != null ? `, Audience: ${audienceScore}%` : ''}`);
        fetched++;
      } else {
        // No score yet — cache the miss for 6 hours so we retry later
        await redisSet(cacheKey, {
          tomatometer: null,
          source: 'agent',
          lastChecked: Date.now(),
        }, 6 * 60 * 60);
        console.log(`    ✗ No score available yet`);
        noScore++;
      }
    } catch (err) {
      console.error(`    ERROR for ${film.title}: ${err.message}`);
    }

    // Be polite to Gemini — 1 request per second
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nDone. Fetched: ${fetched} | Already cached: ${skipped} | No score yet: ${noScore}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
