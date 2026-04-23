import EventCard from './EventCard.jsx';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthDay(date) {
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function filterFilms(films, activeReleaseTypes, activeRatings) {
  return films.filter(f => {
    const typeMatch = activeReleaseTypes.size === 0 || activeReleaseTypes.has(f.releaseType);
    const ratingMatch = activeRatings.size === 0 || activeRatings.has(f.rating);
    return typeMatch && ratingMatch;
  });
}

export default function CalendarGrid({ films, weekOffset, activeReleaseTypes, activeRatings, anchorDate, onFilmClick }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const anchor = anchorDate ? new Date(anchorDate) : today;
  anchor.setHours(0, 0, 0, 0);

  const baseWeek = startOfWeek(anchor);
  baseWeek.setDate(baseWeek.getDate() + weekOffset * 7);

  const weeks = Array.from({ length: 4 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => addDays(baseWeek, wi * 7 + di))
  );

  const filtered = filterFilms(films, activeReleaseTypes, activeRatings);

  const byDay = {};
  for (const f of filtered) {
    const key = f.date.toDateString();
    (byDay[key] ??= []).push(f);
  }

  return (
    <div className="calendar-wrapper">
      <div className="cal-header-row">
        {DAY_NAMES.map(d => (
          <div key={d} className="cal-header-cell">{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="cal-week-row">
          {week.map(day => {
            const isToday = sameDay(day, today);
            const isPast = day < today;
            const dayFilms = byDay[day.toDateString()] ?? [];

            return (
              <div
                key={day.toISOString()}
                className={`cal-day-cell ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}`}
              >
                <div className="day-number">{formatMonthDay(day)}</div>
                <div className="day-events">
                  {dayFilms.map(f => (
                    <EventCard key={f.key} film={f} onClick={() => onFilmClick?.(f)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
