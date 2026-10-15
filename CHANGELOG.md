# Changelog

All notable changes, by phase.

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
