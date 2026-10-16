# TODO

Known gaps and follow-ups. Phases refer to the plan in the README.

## Upcoming phases

- [x] Phase 2 — Quran module and the shared domain layer.
- [x] Phase 3 — Physique module.
- [x] Phase 4 — Degree module.
- [x] Phase 5 — Game module.
- [x] Phase 6 — Today actions, shift-aware planner, weekly review.
- [ ] Phase 7 — Tray, global shortcut, command palettes, notifications.
- [ ] Phase 8 — Backups, JSON import/export, `.ics` export, search.
- [ ] Phase 9 — Packaging (`npm run dist`), macOS CI, README, full E2E, a11y/perf.

## Known gaps

- Planner: blocks cannot cross midnight, and resizing is done in the edit dialog rather
  than by dragging an edge.
- Planner: a proposal covers one week at a time; there is no “repeat last week”.
- Planner: the Degree screen's study suggestions and the weekly proposal are separate
  tools over the same plan blocks; they could be merged.
- Today: the “recency” balance (favouring a goal untouched for days) from the plan is not
  scored yet.
- Habits are daily only; “three times a week” habits would need a weekly target.

- Game: the timer cannot be started from outside the Game screen yet; the tray, global
  shortcut and palettes (Phase 7) will offer start/stop and `g 45m`.
- Game: a devlog "insert this week's summary" (hours, finished tasks) would save typing.
- Game: roadmap tasks are reordered only by editing; drag-to-reorder could follow.
- Degree: discounting rules (e.g. "best 100 of 120 credits"), borderline/rounding
  policies and resits are not modelled; add them once Arden's regulations are known.
- Physique: an adaptive maintenance estimate (from intake vs trend change) would make
  calorie targets self-correcting; not yet implemented.
- Physique: photos are backed up with the data folder in Phase 8; JSON export will
  include them only on request (they can be large).
- Physique: the meal-prep shopping list's ticks are not saved between visits.
- Quran: the revision queue is still sized from Settings or the Quran screen's chip,
  not from the planner's revision block length.
- Quran: an "Undo" of learned pages does not un-complete a milestone that the change
  completed (by design; untick it on the Milestones screen if needed).
- Quran: per-page notes are searchable only once Phase 8 adds search.
- The recovery screen restores from the default backup folder only; a custom
  backup location (Phase 8) must also be readable when the database is damaged.
- macOS-specific visuals (vibrancy, traffic-light alignment) are untested on a real
  Mac — development happens in a Linux container. Please check on first run.
- The renderer bundle is ~3 MB in one chunk; route-level code splitting could
  trim start-up work (low priority for a local app).
