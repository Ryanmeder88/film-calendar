import { useEffect } from 'react';
import { GENRE_COLORS, RATING_COLORS } from '../config.js';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

function lbSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function LbPersonLink({ name, role }) {
  const href = `https://letterboxd.com/${role}/${lbSlug(name)}/`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="lb-link">
      {name}
    </a>
  );
}

const FILM_LINKS = [
  {
    key: 'letterboxd',
    label: 'Letterboxd',
    color: '#00c030',
    url: (title, imdbId) =>
      `https://letterboxd.com/search/films/${encodeURIComponent(title)}/`,
  },
  {
    key: 'rt',
    label: 'Rotten Tomatoes',
    color: '#fa320a',
    url: (title) =>
      `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`,
  },
  {
    key: 'imdb',
    label: 'IMDb',
    color: '#f5c518',
    url: (title, imdbId) =>
      imdbId
        ? `https://www.imdb.com/title/${imdbId}/`
        : `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt&ttype=ft`,
  },
  {
    key: 'metacritic',
    label: 'Metacritic',
    color: '#000000',
    url: (title) =>
      `https://www.metacritic.com/search/${encodeURIComponent(title)}?category=2`,
  },
  {
    key: 'fandango',
    label: 'Fandango',
    color: '#e8168a',
    url: (title) =>
      `https://www.fandango.com/search?q=${encodeURIComponent(title)}&mode=movies`,
  },
];

export default function FilmModal({ film, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!film) return null;

  const genreColors  = GENRE_COLORS[film.primaryGenre] ?? { bg: '#6B7280', text: '#fff' };
  const ratingColors = film.rating ? (RATING_COLORS[film.rating] ?? null) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>

        {/* Backdrop / header */}
        {film.backdropPath ? (
          <div
            className="modal-backdrop"
            style={{ backgroundImage: `url(${TMDB_IMG}/w1280${film.backdropPath})` }}
          />
        ) : (
          <div className="modal-backdrop modal-backdrop-empty" />
        )}

        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-body">
          {/* Poster */}
          {film.posterPath && (
            <img
              className="modal-poster"
              src={`${TMDB_IMG}/w300${film.posterPath}`}
              alt={film.title}
            />
          )}

          {/* Info */}
          <div className="modal-info">
            <h2 className="modal-title">{film.title}</h2>
            {film.tagline && <p className="modal-tagline">"{film.tagline}"</p>}

            {/* Chips row */}
            <div className="modal-chips">
              <span className="event-badge" style={{ background: genreColors.bg, color: genreColors.text }}>
                {film.primaryGenre}
              </span>
              {ratingColors && (
                <span className="modal-rating-chip" style={{ borderColor: ratingColors.bg, color: ratingColors.bg }}>
                  {film.rating}
                </span>
              )}
              {film.runtime && (
                <span className="modal-chip-neutral">{film.runtime} min</span>
              )}
              <span className="modal-chip-neutral">{film.platform}</span>
            </div>

            {/* Scores */}
            {(film.rtScore || film.imdbRating || film.metascore) && (() => {
              const rtPct = film.rtScore ? parseInt(film.rtScore, 10) : null;
              const rtFresh = rtPct !== null && rtPct >= 60;
              const metaScore = film.metascore ? parseInt(film.metascore, 10) : null;
              const metaClass = metaScore === null ? '' : metaScore >= 61 ? 'meta-green' : metaScore >= 40 ? 'meta-yellow' : 'meta-red';
              return (
                <div className="modal-scores">
                  {rtPct !== null && (
                    <span className={`modal-score rt ${rtFresh ? 'rt-fresh' : 'rt-rotten'}`}>
                      <span className="rt-icon">🍅</span>{' '}{film.rtScore}
                    </span>
                  )}
                  {film.imdbRating && <span className="modal-score imdb">⭐ {film.imdbRating}</span>}
                  {metaScore !== null && (
                    <span className={`modal-score meta ${metaClass}`}>{film.metascore}</span>
                  )}
                </div>
              );
            })()}

            {/* Details */}
            <dl className="modal-details">
              {film.director && (
                <>
                  <dt>Director</dt>
                  <dd><LbPersonLink name={film.director} role="director" /></dd>
                </>
              )}
              {film.cast?.length > 0 && (
                <>
                  <dt>Cast</dt>
                  <dd>
                    {film.cast.map((name, i) => (
                      <span key={name}>
                        {i > 0 && ', '}
                        <LbPersonLink name={name} role="actor" />
                      </span>
                    ))}
                  </dd>
                </>
              )}
              {film.boxOffice && (
                <>
                  <dt>Box Office</dt>
                  <dd>{film.boxOffice}</dd>
                </>
              )}
            </dl>

            {/* Plot */}
            {film.overview && <p className="modal-overview">{film.overview}</p>}

            {/* External links */}
            <div className="modal-film-links">
              {FILM_LINKS.map(({ key, label, color, url }) => (
                <a
                  key={key}
                  href={url(film.title, film.imdbId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-film-link"
                  style={{ '--link-color': color }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
