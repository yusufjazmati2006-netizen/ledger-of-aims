# TODO

Known gaps and follow-ups. Phases refer to the plan in the README.

## Upcoming phases

- [x] Phase 2 — Quran module and the shared domain layer.
- [x] Phase 3 — Physique module.
- [x] Phase 4 — Degree module.
- [x] Phase 5 — Game module.
- [x] Phase 6 — Today actions, shift-aware planner, weekly review.
- [x] Phase 7 — Tray, global shortcut, command palettes, notifications.
- [x] Phase 8 — Backups, JSON import/export, `.ics` export, search.
- [x] Phase 9 — Packaging (`npm run dist`), macOS CI, README, full E2E, a11y/perf.

## Before calling it 1.0

- [x] Push the repository to GitHub and run the **macOS app** workflow. It passes on
      GitHub's Mac runner: full E2E suite, universal (x86_64 + arm64) check, packaged-app
      smoke test, and the `.dmg`/`.zip` uploaded as the run's artifact.
- Open the built app on your Mac and look at what Linux could not show: sidebar
  vibrancy and traffic-light alignment, the menu-bar icon and its running time, the
  floating quick-log window's translucency, notification banners, and Open at login.

## Known gaps

- Backups run while the app is open; a day the app is never opened has no backup (none
  is needed — nothing changed). The backup folder on an unmounted external drive shows
  an error in Settings rather than falling back silently.
- Import replaces all data; merging two ledgers is not supported.
- The photos mirror in the backup folder grows with every photo ever added; old photos
  can be removed from it by hand.

- Notifications only appear while the app is running (turn on Open at login).
- Quick log cannot yet log food (`f oats`) or a workout set (`bench 60x8`); both need a
  fuzzy match against your favourites and exercises.

- Planner: blocks cannot cross midnight, and resizing is done in the edit dialog rather
  than by dragging an edge.
- Planner: a proposal covers one week at a time; there is no “repeat last week”.
- Planner: the Degree screen's study suggestions and the weekly proposal are separate
  tools over the same plan blocks; they could be merged.
- Today: the “recency” balance (favouring a goal untouched for days) from the plan is not
  scored yet.
- Habits are daily only; “three times a week” habits would need a weekly target.

- Game: a devlog "insert this week's summary" (hours, finished tasks) would save typing.
- Game: roadmap tasks are reordered only by editing; drag-to-reorder could follow.
- Degree: discounting rules (e.g. "best 100 of 120 credits"), borderline/rounding
  policies and resits are not modelled; add them once Arden's regulations are known.
- Physique: an adaptive maintenance estimate (from intake vs trend change) would make
  calorie targets self-correcting; not yet implemented.
- Physique: the meal-prep shopping list's ticks are not saved between visits.
- Quran: the revision queue is still sized from Settings or the Quran screen's chip,
  not from the planner's revision block length.
- Quran: an "Undo" of learned pages does not un-complete a milestone that the change
  completed (by design; untick it on the Milestones screen if needed).
