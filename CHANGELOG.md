# Changelog

All notable changes, by phase.

## [0.2.0] — Phase 2: Shared domain and the Quran module

### Added

- **Muraja'ah scheduler** (`src/shared/domain/quran/scheduler.ts`): learning steps for
  new pages, ease-based intervals for memorised pages, relearning after a lapse,
  elapsed-time-aware solid reviews, a 30-day maximum interval, retention estimate
  `R = 0.9^(elapsed/interval)`, and deterministic load balancing (±10%). Every
  parameter is editable in Settings, which shows the formulas with live values.
- **Revision queue** sized to the time available (15–90 minute chips for today),
  prioritising recently learned pages, then relearning, then the rotation by relative
  overdueness; contiguous pages grouped into sessions; honest backlog reporting;
  keyboard rating (1/2/3) and per-session "All solid"; Undo on every change.
- **Seeding** of previously memorised juz spreads their first revision over one cycle,
  so day one never shows hundreds of pages.
- **Mushaf grid**: all 604 pages grouped by juz, states (not started / recently
  learned / memorised / needs revision) distinguished by fill and pattern as well as
  colour, due markers, notes, Shift-range selection, arrow-key navigation, and an
  inspector for state changes, ratings and per-page notes.
- **Pace analytics**: rolling 4-week pace (blended with the declared baseline until
  four weeks of data exist), exact page deficit against the interpolated plan,
  ahead / on-track / behind verdict with its equivalent in weeks, pace needed for the
  next milestone, and projected completion against 9 Dec 2027.
- Milestone page targets are computed exactly from the mushaf layout and the
  person's memorisation order (e.g. 20 juz = 404 pages for juz 16–30 going backward).
- **Learning log** with "log N pages" in memorisation order, a weekly chart (from the
  third week; a stat tile before that) and a daily history.
- **Juz overview**: 30 completion rings with retention per juz.
- Onboarding step to choose memorised juz and direction (or set up later).
- **Milestone engine UI**: add, edit, delete, reorder by drag or keyboard (dnd-kit),
  complete; Quran milestones complete themselves when reached.
- **Celebration**: a restrained dialog — the goal ring closes and one serif line names
  the milestone; static under reduced motion.
- **Forgiving streaks** (`src/shared/domain/streaks`): configurable grace days within
  any seven-day window; used for the revision streak.
- Chart primitives (`TimeChart`, `BarChartCard`) with legends, crosshair tooltips,
  ARIA summaries and a table view for every chart; series colours validated for
  colour-vision deficiency.
- Migration `002_quran` (pages and review history).

### Changed

- Stat figures use the sans face with proportional numerals (serif stays for headings).
- The renderer now refreshes settings whenever the main process reports a change.

### Tests

- 126 unit tests (68 new, including property-based scheduler invariants) and 7
  end-to-end flows (Quran revision/undo/logging/mushaf/auto-milestone, set-up later,
  milestone add/edit/keyboard-reorder/complete/delete).

## [0.1.0] — Phase 1: Foundations

### Added

- Electron 44 + electron-vite + React 19 + TypeScript (strict) scaffold, with
  Tailwind CSS 4, Zustand and Zod.
- Typed IPC contract: every channel declares a Zod input schema (validated in the
  main process), an output type and the data it mutates; mutations broadcast
  `data:changed` to every window.
- SQLite persistence (better-sqlite3, WAL) with a transactional migration runner,
  pre-migration snapshots and migration `001_core` (settings, goals, milestones,
  shift types and days, weigh-ins).
- Seed data from the brief: four goals and fourteen milestones from 15 Oct 2026, plus
  the morning (07:30–16:30), night (16:00–01:00) and off shift types.
- Onboarding: starting weight (kg/lb) and this week's shifts, then a summary of the
  seeded goals.
- Today screen: one card per goal with next milestone and countdown, the physique
  weight against its trajectory, today's shift selector, and an editable
  "next single action" per goal.
- Milestones overview, and Settings for theme, reduce motion, units, week start,
  shift hours, data folder and a live privacy readout.
- Recovery screen for a damaged or newer-version database: restore a validated
  backup, or start fresh with the damaged file quarantined (never deleted).
- Network guard, strict CSP and lint rules enforcing the offline guarantee.
- Design system: paper-and-ink tokens with one accent per goal (WCAG AA verified),
  serif headings, primitives (buttons, cards, rings, meters, fields, segmented
  controls, switches, dialogs, toasts) and a custom icon set.
- Original app icon (SVG → PNG/ICNS generator) and menu-bar template image.
- macOS window chrome: hidden-inset title bar, sidebar vibrancy, standard menus with
  ⌘1–⌘9 navigation and ⌘, for Settings; window size and position are remembered.
- Tests: 58 unit tests (dates, migrations, repositories, IPC dispatch, recovery
  services, seed data) and 4 Playwright end-to-end flows (onboarding and restart
  persistence, settings persistence, corruption → start fresh, corruption → restore).
