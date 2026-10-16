-- Full-text search across everything you write. Rebuilt from the source tables when
-- data has changed since the last search (see services/search.ts), so it never drifts.
CREATE VIRTUAL TABLE search_index USING fts5(
  kind UNINDEXED,
  ref UNINDEXED,
  path UNINDEXED,
  date UNINDEXED,
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);
