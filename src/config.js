// TMDB genre ID → display name (hardcoded to avoid an extra API call)
export const TMDB_GENRE_MAP = {
  28:    'Action',
  12:    'Adventure',
  16:    'Animation',
  35:    'Comedy',
  80:    'Crime',
  99:    'Documentary',
  18:    'Drama',
  10751: 'Family',
  14:    'Fantasy',
  36:    'History',
  27:    'Horror',
  10402: 'Music',
  9648:  'Mystery',
  10749: 'Romance',
  878:   'Sci-Fi',
  53:    'Thriller',
  10752: 'War',
  37:    'Western',
};

export const GENRE_COLORS = {
  'Action':      { bg: '#E53E3E', text: '#fff' },
  'Adventure':   { bg: '#DD6B20', text: '#fff' },
  'Animation':   { bg: '#EC4899', text: '#fff' },
  'Comedy':      { bg: '#D97706', text: '#fff' },
  'Crime':       { bg: '#4B5563', text: '#fff' },
  'Documentary': { bg: '#6B7280', text: '#fff' },
  'Drama':       { bg: '#374151', text: '#fff' },
  'Family':      { bg: '#059669', text: '#fff' },
  'Fantasy':     { bg: '#8B5CF6', text: '#fff' },
  'History':     { bg: '#92400E', text: '#fff' },
  'Horror':      { bg: '#1F2937', text: '#fff' },
  'Music':       { bg: '#0891B2', text: '#fff' },
  'Mystery':     { bg: '#4338CA', text: '#fff' },
  'Romance':     { bg: '#DB2777', text: '#fff' },
  'Sci-Fi':      { bg: '#1E40AF', text: '#fff' },
  'Thriller':    { bg: '#7C3AED', text: '#fff' },
  'War':         { bg: '#78350F', text: '#fff' },
  'Western':     { bg: '#92400E', text: '#fff' },
};

// Minimum popularity for theatrical releases
export const THEATRICAL_MIN_POPULARITY = 1;

// Minimum popularity for streaming debuts
export const STREAMING_MIN_POPULARITY = 2;

// Streaming platforms matched against TMDB release_date note field.
// Only films whose type-4 US note exactly matches one of these are included.
export const STREAMING_PLATFORMS = new Set([
  'Netflix',
  'Prime Video',
  'Amazon Prime Video',
  'Hulu',
  'Disney+',
  'Apple TV+',
  'Apple TV',
  'Peacock',
  'Max',
  'HBO Max',
]);

// MPAA ratings in display order
export const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];

export const RATING_COLORS = {
  'G':     { bg: '#16a34a', text: '#fff' },
  'PG':    { bg: '#2563eb', text: '#fff' },
  'PG-13': { bg: '#d97706', text: '#fff' },
  'R':     { bg: '#dc2626', text: '#fff' },
  'NC-17': { bg: '#7f1d1d', text: '#fff' },
};

// Release type display config for filter pills
export const RELEASE_TYPES = [
  { value: 'theatrical-wide',      label: 'Wide',       bg: '#1F2937', text: '#fff' },
  { value: 'theatrical-limited',   label: 'Limited',    bg: '#4B5563', text: '#fff' },
  { value: 'theatrical-rerelease', label: 'Re-release', bg: '#92400E', text: '#fff' },
  { value: 'streaming',            label: 'Streaming',  bg: '#0f766e', text: '#fff' },
];
