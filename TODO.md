# TODO

Known gaps and follow-ups. Phases refer to the plan in the README.

## Upcoming phases

- [x] Phase 2 — Quran module and the shared domain layer.
- [ ] Phase 3 — Physique module.
- [ ] Phase 4 — Degree module.
- [ ] Phase 5 — Game module.
- [ ] Phase 6 — Today actions, shift-aware planner, weekly review.
- [ ] Phase 7 — Tray, global shortcut, command palettes, notifications.
- [ ] Phase 8 — Backups, JSON import/export, `.ics` export, search.
- [ ] Phase 9 — Packaging (`npm run dist`), macOS CI, README, full E2E, a11y/perf.

## Known gaps

- Goal cards for Degree and Game show no progress measure until their modules land
  (Phases 4, 5).
- Quran: the revision queue is sized from Settings or today's chip; Phase 6 will feed
  it from the planner's free time.
- Quran: an "Undo" of learned pages does not un-complete a milestone that the change
  completed (by design; untick it on the Milestones screen if needed).
- Quran: per-page notes are searchable only once Phase 8 adds search.
- The recovery screen restores from the default backup folder only; a custom
  backup location (Phase 8) must also be readable when the database is damaged.
- macOS-specific visuals (vibrancy, traffic-light alignment) are untested on a real
  Mac — development happens in a Linux container. Please check on first run.
- The renderer bundle is ~1 MB in one chunk; route-level code splitting could
  trim start-up work (low priority for a local app).
