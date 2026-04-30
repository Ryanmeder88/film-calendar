import { GENRE_COLORS } from '../config.js';

const RATING_CLASS = {
  'G':     'rating-G',
  'PG':    'rating-PG',
  'PG-13': 'rating-PG13',
  'R':     'rating-R',
  'NC-17': 'rating-NC17',
};

function metaColorClass(score) {
  if (score >= 61) return 'meta-green';
  if (score >= 40) return 'meta-yellow';
  return 'meta-red';
}

export default function EventCard({ film, onClick }) {
  const colors = GENRE_COLORS[film.primaryGenre] ?? { bg: '#6B7280', text: '#fff' };
  const ratingClass = film.rating ? (RATING_CLASS[film.rating] ?? '') : '';

  const rtPct = film.rtScore ? parseInt(film.rtScore, 10) : null;
  const rtFresh = rtPct !== null && rtPct >= 60;

  const metaScore = film.metascore ? parseInt(film.metascore, 10) : null;

  return (
    <div
      className={`event-card ${film.isPast ? 'event-past' : ''}`}
      onClick={onClick}
    >
      <div className="card-top">
        <span className="event-badge" style={{ background: colors.bg, color: colors.text }}>
          {film.primaryGenre}
        </span>
        {film.rating && (
          <span className={`rating-chip ${ratingClass}`}>{film.rating}</span>
        )}
      </div>
      <span className="event-title">{film.title}</span>
      {film.director && (
        <span className="event-director">{film.director}</span>
      )}
      <div className="event-scores">
        {rtPct !== null && (
          <span className={`event-rt ${rtFresh ? 'rt-fresh' : 'rt-rotten'}`}>
            <span className="rt-icon">{rtFresh ? '🍅' : '🫟'}</span>{' '}{film.rtScore}
          </span>
        )}
        {metaScore !== null && (
          <span className={`event-meta ${metaColorClass(metaScore)}`}>
            {film.metascore}
          </span>
        )}
      </div>
      {film.releaseType === 'theatrical-rerelease' && (
        <span className="event-rerelease">Re-release</span>
      )}
      {film.platforms?.length > 0 && (
        <span className="event-platform">{film.platforms.join(' · ')}</span>
      )}
    </div>
  );
}
