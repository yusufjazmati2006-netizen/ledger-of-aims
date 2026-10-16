-- Found in the Phase 9 performance pass: the one date-ranged table without an index.
CREATE INDEX prep_sessions_date ON prep_sessions(date);
