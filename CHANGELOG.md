# Changelog

All notable changes, by phase.

## [0.9.0] — Phase 9: Ship

### Added

- **GitHub Actions**: `CI` (typecheck, lint, format, unit tests, contrast, end-to-end
  suite under Xvfb) and `macOS app` (checks and the end-to-end suite on a Mac runner,
  universal `.dmg` + `.zip`, a check that the app contains both architectures, a smoke
  test of the packaged app, artifacts, and release attachment for `v*` tags).
- **Open at login** (installed Mac app), so reminders and the daily backup run on days
  the app is not opened by hand.
- **Accessibility audit**: axe (WCAG 2.2 A/AA) across every screen, the command palette,
  and both themes, as an end-to-end test.
- **Performance budgets** as an end-to-end test (cold start to a populated Today, the
  604-cell mushaf, the planner), and query-plan tests requiring an index for every
  hot date-range query.
- **Offline proof**: `npm run test:offline` runs the whole end-to-end suite with
  networking removed, and every end-to-end test now checks the network guard's log
  when it closes the app.
- `npm run dist:linux` and `LEDGER_E2E_EXECUTABLE` to package the app and run the suite
  against the packaged binary.
- A full README: install and first launch, everyday use, shortcuts, data and backups,
  privacy verification, development, releasing, troubleshooting.

### Changed

- The renderer is minified and split by screen: the start-up bundle fell from 3.2 MB
  (unminified, one chunk) to 0.49 MB; charts and the markdown devlog load on first use.
- Migration `009_indexes` adds the one missing date index (meal-prep sessions).

### Fixed

- **Dark theme did not apply on platforms where Electron's theme choice does not reach
  `prefers-color-scheme`**; the chosen theme is now also set on the document, which
  the colour tokens follow.
- Accessibility (found by the audit): the mushaf grid's ARIA structure; charts hidden
  from assistive technology while still focusable; buttons whose accessible name did
  not include their visible text; click targets under 24 px; past days in the planner
  faded below contrast.
- Packaging: each platform now keeps its own SQLite binaries (a Linux package had kept
  only the macOS ones), and no auto-update metadata is written.

### Tests

- 313 unit tests and 21 end-to-end flows, passing both normally and with networking
  removed; 10 of the flows also pass against the packaged Linux build.

## [0.8.0] — Phase 8: Backups, export and search

### Added

- **Daily backups**, automatic and local: the first time the app runs each day (and
  every half hour after midnight while it stays open) a consistent copy of the
  database goes to `~/Documents/LedgerOfAims Backups`; the last 30 daily copies are
  kept. Photos are mirrored alongside (copied once, never deleted), so every backup's
  photos stay restorable. **Back up now** makes a manual copy.
- **A backup folder of your choosing** (an external drive or a synced folder). Its
  location lives in a small file outside the database, so the recovery screen still
  finds your backups when the database itself is damaged.
- **Restore** from Settings → Backups or from any `.sqlite` file: the current data is
  first saved as a “Before a restore” backup, the photos the backup needs are put
  back, and the app reloads. Restoring is therefore always undoable.
- **JSON export** of everything (photos optional) and **import** with a preview of
  what changes, table by table, before anything is replaced. Imports are validated
  (format, version, every table and column), snapshot the current data first, run in
  one transaction and are rolled back entirely if any link between records is broken.
  An export from a newer version is refused.
- **Calendar export (.ics)** of milestones, deadlines, and the next eight weeks of plan
  blocks and shifts, with stable event ids so re-importing updates rather than
  duplicates; night shifts end on the following morning.
- **Search** (⌘9, and inside ⌘K): full-text, prefix-matching search across milestones,
  the roadmap, learning notes and engine decisions, practice projects, the devlog
  (including tags), the Steam checklist, modules and assessments, Quran page notes,
  weekly reviews, habits, notes on time, study, workouts, weigh-ins and photos, and
  foods and exercises — with the matches highlighted.
- Migration `008_search` (an FTS5 index, rebuilt from your data when it has changed).

### Fixed

- Development and test builds reported version “0.0”; the version now comes from
  package.json at build time.

### Tests

- 297 unit tests (adding the calendar writer, search with accents and transliteration
  marks, backups and retention, export/import round trip, refusals and rollback) and 19
  end-to-end flows, including restoring after a damaged database from a custom backup
  folder.

## [0.7.0] — Phase 7: Quick log, menu bar and notifications

### Added

- **Quick-log grammar** shared by every entry point: `w 72.4`, `p 3`, `p 322-324`,
  `r 1-20 solid`, `r j17 shaky`, `s 1.5h essay`, `g 45m`, `g start` / `g stop`, `wo`,
  `h phone`. Each line is previewed before you press Return (“Log 70.2 kg as today’s
  weight”), incomplete lines explain what is missing, and lines that cannot run say
  why (“None of those pages are learned yet”).
- **⌘K command palette** in the main window (also Go → Command Palette…): the grammar
  plus search across every screen and sub-screen, with full keyboard control.
- **Global quick-log window**: Ctrl+Shift+Space from any app opens a small floating
  palette; log, see it confirmed, and it hides itself. Escape or clicking away
  dismisses it.
- **Menu-bar item** (template icon): quick log, start/stop the game timer with its
  running time shown beside the icon, and shortcuts to Today, Planner and Weekly
  review.
- **Notifications** for due revision, the weigh-in, training days, degree deadlines
  (7, 3, 1 and 0 days before by default), the weekly review, planned blocks (10
  minutes before) and a forgotten game timer. Each is sent once, only if still
  relevant, never in quiet hours (22:30–07:00 by default), and — unless switched off
  — held during shifts and the sleep window after a night shift until you are up.
  Clicking one opens the right screen.
- Settings → Notifications (every reminder on its own switch and time, quiet hours, a
  test button) and Settings → Menu bar & shortcut (a shortcut recorder that reports
  when another app already uses the combination).
- Migration `007_notifications` (a log of sent reminders, pruned after 60 days).

### Tests

- 284 unit tests (grammar, reminder rules and holds, state gathering, palette search,
  shortcut recording) and 15 end-to-end flows, including the floating window, ⌘K and
  notifications held after a night shift.

## [0.6.0] — Phase 6: Today, planner, weekly review

### Added

- **Today’s focus**: actions from every goal — due revision, new pages, the weigh-in,
  a due training session, the nearest deadline (or study if behind), the game’s next
  task, habits at risk — scored by urgency, how far behind each goal is and streak
  risk, then packed into the free time left today by your shift pattern, or into
  15 min / 30 min / 1 h / 2 h. What does not fit is listed under “If you have more
  time”; one-minute actions are never crowded out.
- **Planner** (⌘6): a week of day columns showing each shift with its commute, the
  hours kept for sleep (after a night shift, before a morning one) and every planned
  block. Shifts are set from the column headers.
  - **Propose a plan** fills the free windows in priority order — Quran revision,
    training on its every-other-day rhythm, new pages, the week’s remaining study and
    game hours, meal prep on a day off — and shows it as a dashed preview to accept or
    discard. Whatever does not fit is reported.
  - **Drag to adjust** with the mouse, or from the keyboard (Space to pick up, arrows
    for 15 minutes or a day, Space to drop, Escape to cancel; Enter edits). A moved or
    added block is kept by later proposals; **Clear proposed** removes the rest.
  - **Conflicts** in words: a block on a shift or its commute, in the sleep window, two
    blocks overlapping (shown side by side), and short sleep between a night and a
    morning shift.
  - Finishing a study or game block logs its time.
- **Weekly review** (⌘7): the week in figures (pages learned and revised, game hours,
  focus sessions, finished tasks, devlog entries, study, workouts, weigh-ins and the
  week’s change, plan blocks done, milestones reached), three reflections and three
  priorities for the next week. Completing it records the figures; a draft can be
  saved. Last week’s review is offered first early in a week if it was missed.
  History lists every review.
- **Habits** with forgiving streaks (0–2 grace days a week each), a 14-day strip to
  tick or correct past days, archive and restore. Tick them on Today.
- Today also shows the week’s priorities, today’s planned blocks (tick to finish) and a
  nudge when a review is due.
- Settings → Planner: training, game and meal-prep session lengths and meal preps per
  week.
- Migration `006_planning` (weekly reviews, habits, habit checks).

### Changed

- The sidebar gains Planner and Weekly review after the four goals, so Milestones
  moves to ⌘8.

### Tests

- 266 unit tests (week proposals, demands, conflicts, lanes, prioritisation and
  packing, review metrics, habits, atomic plan replacement) and 12 end-to-end flows,
  including keyboard dragging and a review whose priorities appear on Today the
  following Monday.

## [0.5.0] — Phase 5: Game

### Added

- **Roadmap**: six seeded phases (Foundations → Release) linked to the game milestones,
  with tasks, optional hour estimates, notes and dependencies. Adding a dependency that
  would create a loop is refused; a task waiting on unfinished work cannot be ticked
  and says what it is waiting on. Progress rolls up per phase and overall, weighted by
  estimate (unestimated tasks count as the average estimate). "You can do now" lists
  the unblocked tasks in roadmap order.
- **Next single action**: edited in place at the top of the Game screen and shown on
  Today.
- **Learning path**: seeded fundamentals with notes and your own resource links (which
  open in your browser), and an engine decision log with the reasons.
- **Practice board**: small projects by status (idea, in progress, finished, shelved)
  with start/finish dates stamped automatically and lessons learned.
- **Time**: a timer that survives restarts (and shows in the sidebar while running,
  with a gentle warning after four hours), manual entries (`45m`, `1.5h`, `1:30`),
  corrections to any finished entry, weekly hours against a target (6 h by default),
  and a session log grouped by day with focus sessions marked and filterable. Entries
  that cross midnight are split across the two days.
- **Devlog**: dated markdown entries with tags, a write/preview editor, tag filters and
  search. Raw HTML is ignored and remote images are never loaded.
- **Steam readiness**: a sectioned checklist with progress. Seeded details are "last
  known" values flagged **Verify** against the current Steamworks documentation, under
  a prominent banner; items can be added, edited and flagged by you.
- Today's Game card: roadmap progress, hours this week, what is up next, and whether a
  timer is running.
- Settings → Game (weekly hours target, forgotten-timer threshold).
- Migration `005_game` (phases, tasks, dependencies, learning items, engine decisions,
  practice projects, time entries with at most one running timer, devlog, Steam
  checklist).

### Changed

- Goals now appear in the order of their letters everywhere — A Quran, B Game,
  C Degree, D Physique — in the sidebar (⌘3 is now Game, ⌘4 Degree, ⌘5 Physique), on Today,
  in Milestones and in Settings.

### Tests

- 245 unit tests (roadmap cycles, blocking and rollup; time split across midnight and
  DST; duration parsing; game repository) and 10 end-to-end flows, including a Game
  flow that restarts the app with a timer running.

## [0.4.0] — Phase 4: Degree

### Added

- **Structure**: three seeded years (Levels 4–6, dates left for you to enter), modules
  with credits, and assessments with type, weight, due date, status and grade. A grade
  marks an assessment graded; module templates (100% coursework, 50/50, 40/60).
- **UK honours projection** from graded work, weighted by credits and by level
  (editable; Level 5 : Level 6 = 1 : 2 by default with Level 4 not counted), with the
  share of the final classification already determined.
- **"What do I need?"** — the exact uniform mark needed on all remaining work for a
  First, 2:1 and 2:2, reported as secured, achievable or out of reach. Credits not yet
  entered count as remaining work so the answer is honest early on.
- **What-if** marks for ungraded assessments, recalculated live and never saved.
- **Deadlines**: the next three countdowns with escalating urgency (calm / coming up /
  this week / imminent / overdue — each with colour, icon and label), and a month
  calendar of assessments and milestones.
- **Shift-aware free time** (`src/shared/domain/planner/freeTime.ts`): wake after
  night shifts (sleep + routine), early bedtimes before morning shifts, commute and
  recovery around shifts, and a warning for short sleep between shifts.
- **Study planner**: sessions proposed into free windows to meet the weekly target,
  accepted into the plan, ticked off to log time; weekly hours chart.
- Settings → Degree (weights, boundaries, credits per level, study target) and
  Settings → Planner (sleep, commute, wind-down, routine, recovery, day bounds).
- Today's Degree card: next deadline countdown and projected class.
- Migration `004_degree` (years, modules, assessments, study sessions, plan blocks).

### Fixed

- An average of exactly 70 computed as 69.999… was classed as a 2:1; class bands now
  tolerate floating-point error.

### Tests

- 204 unit tests (classification, requirements, what-if, urgency, intervals, free
  time around every shift combination, session proposals) and 9 end-to-end flows.

## [0.3.0] — Phase 3: Physique

### Added

- **Weight trend**: exponentially smoothed trend (α = 0.1, tunable) with gaps filled
  by interpolation; weekly rate from a 14-day least-squares slope; plotted with raw
  weigh-ins and the plan line (30 days / 90 days / year / whole plan).
- **Rate verdict**: too fast / on pace / too slow against the plan's required rate,
  capped at 0.5% of bodyweight a week, with a plain-language suggestion; shown only
  once there are five weigh-ins over ten days.
- **Weigh-in logging** in one field (kg or lb), back-dating, Undo that restores the
  previous value.
- **Checkpoints** complete automatically when the _trend_ (not a single weigh-in)
  reaches them, with the shared celebration.
- **Training**: every-other-day status (rest-day aware; a missed session shifts the
  cycle rather than doubling up), a two-week calendar strip, a per-exercise set
  logger with double-progression suggestions (add reps → add load → deload after two
  stalled sessions), PR detection (Epley e1RM) on every set, records table, recent
  sessions, and an exercise library with programme membership and archiving.
- **Nutrition**: calorie and protein targets from Mifflin–St Jeor (or 33 kcal/kg)
  plus a chosen surplus, with the working shown; one-tap favourites; custom entries;
  daily adherence score; forgiving nutrition streak; 14-day adherence chart.
- **Meal prep**: weekly plan from favourites with per-day totals against target, copy a
  day across the week, log a planned day as eaten, an aggregated shopping list
  (units normalised), and prep sessions.
- **Progress photos**: imported into the private data folder (HEIC converted on
  macOS), thumbnails, a gallery and side-by-side comparison with trend weights;
  served through a local `ledger-photo://` protocol.
- Settings → Physique for height, birth year, sex, activity, surplus, protein,
  overrides, smoothing, rate thresholds, rest days and streak rules.
- Today's Physique card: trend weight, rate verdict, training status and intake.
- Seeded exercise library (20 exercises, an 8-exercise default programme) and ten
  starter favourites marked as approximate.
- Migration `003_physique`.

### Tests

- 173 unit tests (47 new: trend, rate, nutrition, adherence, progression, PRs,
  schedule, meal plan, repositories, milestone auto-completion) and 8 end-to-end
  flows (new: weigh-in/undo, PR set logging, nutrition, meal prep, photo import).

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
