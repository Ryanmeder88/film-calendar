import { useState, useEffect, useCallback } from 'react';
import { fetchAllFilms } from './api.js';
import { RELEASE_TYPES, RATINGS, RATING_COLORS } from './config.js';
import CalendarGrid from './components/CalendarGrid.jsx';
import ScheduleList from './components/ScheduleList.jsx';
import FilmModal from './components/FilmModal.jsx';
import { useIsMobile } from './hooks/useIsMobile.js';
import './App.css';

export default function App() {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeReleaseTypes, setActiveReleaseTypes] = useState(new Set(['theatrical-wide']));
  const [activeRatings, setActiveRatings] = useState(new Set());
  const [anchorDate, setAnchorDate] = useState(null);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const isMobile = useIsMobile();

  const load = useCallback(async (anchor = null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllFilms(anchor ?? new Date());
      setFilms(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError('Failed to load film data. Check your TMDB access token.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleDateChange(e) {
    const val = e.target.value;
    if (!val) return;
    const d = new Date(val + 'T00:00:00');
    setAnchorDate(d);
    setWeekOffset(0);
    load(d);
  }

  function handleToday() {
    setAnchorDate(null);
    setWeekOffset(0);
    load(null);
  }

  function toggleReleaseType(type) {
    setActiveReleaseTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  function toggleRating(rating) {
    setActiveRatings(prev => {
      const next = new Set(prev);
      next.has(rating) ? next.delete(rating) : next.add(rating);
      return next;
    });
  }

  const presentReleaseTypes = new Set(films.flatMap(f => f.releaseTypes));
  const presentRatings = new Set(films.map(f => f.rating).filter(Boolean));

  const dateDisplayText = anchorDate
    ? anchorDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Jump to date';

  const filterProps = { activeReleaseTypes, activeRatings, onFilmClick: setSelectedFilm };

  return (
    <div className="app">
      <div className="sticky-top">
        <header className="app-header">
          <div className="header-left">
            <h1>Film Calendar</h1>
            {lastRefresh && (
              <span className="last-refresh">
                Updated {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="header-right">
            {isMobile ? (
              <div className="date-picker-wrapper">
                <span className="date-picker-display">{dateDisplayText}</span>
                <input
                  type="date"
                  className="date-picker date-picker-hidden"
                  value={anchorDate ? anchorDate.toISOString().slice(0, 10) : ''}
                  onChange={handleDateChange}
                />
              </div>
            ) : (
              <input
                type="date"
                className="date-picker"
                value={anchorDate ? anchorDate.toISOString().slice(0, 10) : ''}
                onChange={handleDateChange}
                title="Jump to date"
              />
            )}
            {anchorDate && (
              <button className="btn-today" onClick={handleToday}>Today</button>
            )}
            <button className="btn-refresh" onClick={() => load(anchorDate)} disabled={loading}>
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>
        </header>

        <div className="filter-bar">
          {/* Release type pills */}
          <div className="filter-bar-inner">
            <span className="filter-row-label">Type</span>
            <button
              className={`filter-pill all-pill ${activeReleaseTypes.size === 0 ? 'active' : ''}`}
              onClick={() => setActiveReleaseTypes(new Set())}
            >
              All
            </button>
            {RELEASE_TYPES.map(t => {
              const isActive = activeReleaseTypes.has(t.value);
              return (
                <button
                  key={t.value}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{
                    '--pill-bg': t.bg,
                    '--pill-fg': t.text,
                    boxShadow: isActive ? `0 0 0 2px #fff, 0 0 0 4px ${t.bg}` : 'none',
                  }}
                  onClick={() => toggleReleaseType(t.value)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Rating pills */}
          <div className="filter-bar-inner">
            <span className="filter-row-label">Rating</span>
            <button
              className={`filter-pill all-pill ${activeRatings.size === 0 ? 'active' : ''}`}
              onClick={() => setActiveRatings(new Set())}
            >
              All
            </button>
            {RATINGS.filter(r => presentRatings.has(r)).map(rating => {
              const colors = RATING_COLORS[rating];
              const isActive = activeRatings.has(rating);
              return (
                <button
                  key={rating}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{
                    '--pill-bg': colors.bg,
                    '--pill-fg': colors.text,
                    boxShadow: isActive ? `0 0 0 2px #fff, 0 0 0 4px ${colors.bg}` : 'none',
                  }}
                  onClick={() => toggleRating(rating)}
                >
                  {rating}
                </button>
              );
            })}
          </div>
        </div>

        <div className="week-nav">
          <button className="btn-nav" onClick={() => setWeekOffset(w => w - 1)} disabled={weekOffset <= 0}>
            ← Prev
          </button>
          <span className="week-label">
            {weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : `+${weekOffset} weeks`}
            {' '}· 4-week view
          </span>
          <button className="btn-nav" onClick={() => setWeekOffset(w => w + 1)}>
            Next →
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && films.length === 0 ? (
        <div className="loading-state">Loading releases…</div>
      ) : isMobile ? (
        <ScheduleList
          films={films}
          weekOffset={weekOffset}
          anchorDate={anchorDate}
          {...filterProps}
        />
      ) : (
        <CalendarGrid
          films={films}
          weekOffset={weekOffset}
          anchorDate={anchorDate}
          {...filterProps}
        />
      )}

      {selectedFilm && <FilmModal film={selectedFilm} onClose={() => setSelectedFilm(null)} />}

      <footer className="app-footer">
        Data via TMDB · {films.length} releases loaded · U.S. theatrical
      </footer>
    </div>
  );
}
