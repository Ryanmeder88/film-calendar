import { useRef, useEffect } from 'react';
import { GENRE_COLORS } from '../config.js';

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatDayHeader(date, today) {
  if (sameDay(date, today)) return 'Today';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function filterFilms(films, activeReleaseTypes, activeRatings) {
  return films.filter(f => {
    const typeMatch = activeReleaseTypes.size === 0 || activeReleaseTypes.has(f.releaseType);
    const ratingMatch = activeRatings.size === 0 || activeRatings.has(f.rating);
    return typeMatch && ratingMatch;
  });
}

export default function ScheduleList({ films, weekOffset, activeReleaseTypes, activeRatings, anchorDate, onFilmClick }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const anchor = anchorDate ? new Date(anchorDate) : today;
  anchor.setHours(0, 0, 0, 0);

  const baseWeek = startOfWeek(anchor);
  baseWeek.setDate(baseWeek.getDate() + weekOffset * 7);

  const todayRef = useRef(null);
  const hasScrolled = useRef(false);
  useEffect(() => {
    if (hasScrolled.current || !todayRef.current || films.length === 0) return;
    const t = setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
      hasScrolled.current = true;
    }, 50);
    return () => clearTimeout(t);
  }, [films.length]);

  const days = Array.from({ length: 28 }, (_, i) => addDays(baseWeek, i));
  const filtered = filterFilms(films, activeReleaseTypes, activeRatings);

  const byDay = {};
  for (const f of filtered) {
    const key = f.date.toDateString();
    (byDay[key] ??= []).push(f);
  }

  const activeDays = days.filter(d => (byDay[d.toDateString()]?.length ?? 0) > 0);

  if (activeDays.length === 0) {
    return <div className="schedule-empty">No releases in this period.</div>;
  }

  return (
    <div className="schedule-list">
      {activeDays.map(day => {
        const isToday = sameDay(day, today);
        const isPast = day < today && !isToday;
        const dayFilms = byDay[day.toDateString()];

        return (
          <div key={day.toISOString()} className="schedule-day-group" ref={isToday ? todayRef : null}>
            <div className={`schedule-day-header ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}`}>
              {formatDayHeader(day, today)}
            </div>
            {dayFilms.map(f => {
              const colors = GENRE_COLORS[f.primaryGenre] ?? { bg: '#6B7280', text: '#fff' };
              return (
                <div key={f.key} className={`schedule-row ${f.isPast ? 'schedule-row-past' : ''}`} onClick={() => onFilmClick?.(f)} style={{ cursor: 'pointer' }}>
                  <span className="schedule-badge" style={{ background: colors.bg, color: colors.text }}>
                    {f.primaryGenre}
                  </span>
                  <div className="schedule-main">
                    <span className="schedule-matchup">{f.title}</span>
                    {f.rating && <span className="schedule-meta">{f.rating}</span>}
                  </div>
                  <span className="schedule-platform">{f.platform}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
