# TODO

Known gaps and follow-ups. Phases refer to the plan in the README.

## Upcoming phases

- [ ] Phase 2 — Quran module and the shared domain layer (streaks, milestone editing
      with reordering and celebration).
- [ ] Phase 3 — Physique module.
- [ ] Phase 4 — Degree module.
- [ ] Phase 5 — Game module.
- [ ] Phase 6 — Today actions, shift-aware planner, weekly review.
- [ ] Phase 7 — Tray, global shortcut, command palettes, notifications.
- [ ] Phase 8 — Backups, JSON import/export, `.ics` export, search.
- [ ] Phase 9 — Packaging (`npm run dist`), macOS CI, README, full E2E, a11y/perf.

## Known gaps

- Goal cards for Quran, Degree and Game show no progress measure until their
  modules land (Phases 2, 4, 5).
- Milestones are read-only in the UI until Phase 2 (the IPC and repository support
  editing already).
- The recovery screen restores from the default backup folder only; a custom
  backup location (Phase 8) must also be readable when the database is damaged.
- macOS-specific visuals (vibrancy, traffic-light alignment) are untested on a real
  Mac — development happens in a Linux container. Please check on first run.
- The renderer bundle is ~1 MB in one chunk; route-level code splitting could
  trim start-up work (low priority for a local app).
