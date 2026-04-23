import { TMDB_GENRE_MAP, THEATRICAL_MIN_POPULARITY } from './config.js';

const BASE = '/tmdb-api';

function createLimiter(max) {
  let active = 0;
  const queue = [];
  function tick() {
    while (active < max && queue.length > 0) {
      const { fn, resolve, reject } = queue.shift();
      active++;
      fn().then(resolve, reject).finally(() => { active--; tick(); });
    }
  }
  return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); tick(); });
}
const limit = createLimiter(15);

function dateStr(date) {
  return date.toISOString().slice(0, 10);
}

async function tmdbGet(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

function resolveGenres(genreIds) {
  return (genreIds ?? []).map(id => TMDB_GENRE_MAP[id]).filter(Boolean);
}

function parseUsCertification(results) {
  const us = results?.find(r => r.iso_3166_1 === 'US');
  if (!us) return null;
  const theatrical = us.release_dates?.find(r => r.type === 3 && r.certification);
  const any = us.release_dates?.find(r => r.certification);
  return (theatrical ?? any)?.certification ?? null;
}


function parseUsReleaseDate(results, type) {
  const us = results?.find(r => r.iso_3166_1 === 'US');
  const entry = us?.release_dates?.find(r => r.type === type);
  return entry?.release_date ? new Date(entry.release_date.slice(0, 10) + 'T00:00:00') : null;
}

function parseUsRereleaseDate(results, windowStart, cutoff) {
  const us = results?.find(r => r.iso_3166_1 === 'US');
  const theatrical = us?.release_dates?.filter(r => r.type === 3 || r.type === 2) ?? [];
  const entry = theatrical.find(r => {
    const d = new Date(r.release_date.slice(0, 10) + 'T00:00:00');
    return d >= windowStart && d <= cutoff;
  });
  return entry ? new Date(entry.release_date.slice(0, 10) + 'T00:00:00') : null;
}

const BASE_THEATRICAL_PARAMS =
  `&region=US&with_original_language=en&without_genres=99,10770` +
  `&sort_by=popularity.desc&popularity.gte=${THEATRICAL_MIN_POPULARITY}&with_runtime.gte=40`;

const EXCLUDE_GENRES = new Set([99, 10770]); // Documentary, TV Movie

// Theatrical: discover (wide + limited) for new releases, upcoming for re-releases
async function fetchTheatrical(windowStart, cutoff) {
  const dateRange = `&release_date.gte=${dateStr(windowStart)}&release_date.lte=${dateStr(cutoff)}`;

  const [wideResults, limitedResults, upcomingResults] = await Promise.all([
    Promise.allSettled([1, 2, 3].map(page =>
      limit(() => tmdbGet(`/discover/movie?with_release_type=3${BASE_THEATRICAL_PARAMS}${dateRange}&page=${page}`))
    )),
    Promise.allSettled([1, 2].map(page =>
      limit(() => tmdbGet(`/discover/movie?with_release_type=2${BASE_THEATRICAL_PARAMS}${dateRange}&page=${page}`))
    )),
    Promise.allSettled([1, 2, 3].map(page =>
      limit(() => tmdbGet(`/movie/upcoming?language=en-US&region=US&page=${page}`))
    )),
  ]);

  const wide = wideResults
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value.results ?? [])
    .map(m => ({ ...m, _tmdbType: 3 }));

  const limited = limitedResults
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value.results ?? [])
    .map(m => ({ ...m, _tmdbType: 2 }));

  // Discover: wide takes precedence over limited
  const discoverIds = new Set();
  const discoverMerged = [];
  for (const m of [...wide, ...limited]) {
    if (!discoverIds.has(m.id)) { discoverIds.add(m.id); discoverMerged.push(m); }
  }

  // Upcoming: films NOT in discover whose original release_date predates our window = re-releases
  const upcoming = upcomingResults
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value.results ?? [])
    .filter(m => !discoverIds.has(m.id))
    .filter(m => !m.genre_ids?.some(id => EXCLUDE_GENRES.has(id)))
    .filter(m => new Date(m.release_date + 'T00:00:00') < windowStart)
    .map(m => ({ ...m, _tmdbType: 3 }));

  const allIds = new Set(discoverIds);
  const rereleaseMerged = [];
  for (const m of upcoming) {
    if (!allIds.has(m.id)) { allIds.add(m.id); rereleaseMerged.push(m); }
  }

  return [...discoverMerged, ...rereleaseMerged]
    .filter(m => m.popularity >= THEATRICAL_MIN_POPULARITY)
    .map(m => {
      const originalDate = new Date(m.release_date + 'T00:00:00');
      const isRerelease = originalDate < windowStart;
      const releaseType = isRerelease
        ? 'theatrical-rerelease'
        : m._tmdbType === 3 ? 'theatrical-wide' : 'theatrical-limited';
      return { ...m, _releaseType: releaseType };
    });
}


async function fetchCertifications(movieIds) {
  const results = await Promise.allSettled(
    movieIds.map(id =>
      limit(() => tmdbGet(`/movie/${id}?append_to_response=release_dates,credits`))
    )
  );
  const map = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      map[r.value.id] = {
        releaseDates: r.value.release_dates?.results ?? [],
        runtime: r.value.runtime ?? null,
        director: r.value.credits?.crew?.find(c => c.job === 'Director')?.name ?? null,
        cast: r.value.credits?.cast?.slice(0, 6).map(c => c.name) ?? [],
        tagline: r.value.tagline || null,
        backdropPath: r.value.backdrop_path ?? null,
        imdbId: r.value.imdb_id ?? null,
      };
    }
  }
  return map;
}

async function fetchOmdbRatings(imdbIds) {
  const results = await Promise.allSettled(
    imdbIds.map(id =>
      limit(() => fetch(`/omdb-api?i=${id}`).then(r => r.ok ? r.json() : null))
    )
  );
  const map = {};
  for (let i = 0; i < imdbIds.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value?.Response === 'True') {
      const d = r.value;
      const na = v => (v && v !== 'N/A') ? v : null;
      const rt = d.Ratings?.find(x => x.Source === 'Rotten Tomatoes');
      map[imdbIds[i]] = {
        rtScore:    rt ? na(rt.Value) : null,
        imdbRating: na(d.imdbRating),
        metascore:  na(d.Metascore),
        awards:     na(d.Awards),
        boxOffice:  na(d.BoxOffice),
      };
    }
  }
  return map;
}

export async function fetchAllFilms(anchorDate = new Date()) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const windowStart = new Date(anchorDate ?? today);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - windowStart.getDay());

  const cutoff = new Date(windowStart.getTime() + 28 * 24 * 60 * 60 * 1000);

  const theatrical = await fetchTheatrical(windowStart, cutoff);

  const uniqueIds = [...new Set(theatrical.map(m => m.id))];
  const certMap = await fetchCertifications(uniqueIds);

  const imdbIds = uniqueIds.map(id => certMap[id]?.imdbId).filter(Boolean);
  const omdbMap = await fetchOmdbRatings(imdbIds);

  const events = theatrical
    .filter(m => {
      const { runtime } = certMap[m.id] ?? {};
      return !runtime || runtime >= 40;
    })
    .map(m => {
      const { releaseDates = [], director = null, cast = [], tagline = null, backdropPath = null, imdbId = null } = certMap[m.id] ?? {};
      const omdb = imdbId ? (omdbMap[imdbId] ?? {}) : {};
      const { rtScore = null, imdbRating = null, metascore = null, awards = null, boxOffice = null } = omdb;
      const rating = parseUsCertification(releaseDates);
      const genres = resolveGenres(m.genre_ids);
      const primaryGenre = genres[0] ?? 'Film';

      const releaseType = m._releaseType;
      const usDate = releaseType === 'theatrical-rerelease'
        ? parseUsRereleaseDate(releaseDates, windowStart, cutoff)
        : parseUsReleaseDate(releaseDates, m._tmdbType ?? 3);
      const date = usDate ?? new Date(m.release_date + 'T00:00:00');

      const platform = releaseType === 'theatrical-limited'
        ? 'In Theaters (Limited)'
        : 'In Theaters';

      return {
        key: `tmdb__${m.id}__${releaseType}`,
        movieId: m.id,
        date,
        title: m.title,
        overview: m.overview ?? '',
        genres,
        primaryGenre,
        rating,
        releaseType,
        platform,
        posterPath: m.poster_path,
        popularity: m.popularity,
        director,
        cast,
        tagline,
        backdropPath,
        runtime: certMap[m.id]?.runtime ?? null,
        rtScore,
        imdbRating,
        metascore,
        awards,
        boxOffice,
        imdbId,
        isPast: date < today,
      };
    });

  return events
    .filter(e => e.date >= windowStart && e.date <= cutoff)
    .sort((a, b) => a.date - b.date);
}
