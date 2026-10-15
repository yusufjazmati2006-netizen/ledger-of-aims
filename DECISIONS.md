# Decisions

Product and engineering decisions made while building Ledger of Aims, with the
reasoning. Anything here can be revisited; most are editable defaults in the app.

## Platform & stack

- **electron-vite** builds main, preload and renderer from one config (the brief's
  "Vite" requirement, without hand-wiring three builds).
- **TypeScript 6.0**, not 7: typescript-eslint (strict type-checked rules) supports
  TypeScript `<6.1`. Strict linting was judged more valuable than the newer compiler.
- **better-sqlite3 13** ships Node-API prebuilt binaries for macOS arm64 and x64
  inside the package. The same binary loads in Node (unit tests) and Electron, and
  packaging needs no native rebuild (`npmRebuild: false`). Database tests therefore
  run under plain Vitest rather than "Electron as Node".
- Renderer-only libraries are `devDependencies` and bundled by Vite; only
  `better-sqlite3` is a runtime dependency. This keeps the packaged app small.
- **Zustand** holds app-wide state (settings, today); screen data comes from a small
  stale-while-revalidate hook (`useLedger`) that refreshes on `data:changed` events
  broadcast by the main process after every mutation. No extra query library.
- **Lint:** `no-confusing-void-expression` allows arrow shorthand so idiomatic React
  handlers (`onClick={() => setOpen(true)}`) need no ceremony.
- **Charts** use Recharts with colours read from the design tokens at runtime (SVG
  attributes cannot resolve CSS variables). Reference lines use a neutral grey chosen
  with the dataviz palette validator to stay distinguishable from every goal accent
  under colour-vision deficiency, in both themes.
- **Zod 4 patches:** `.partial()` still applies field defaults in Zod 4, so a
  one-field patch would reset other fields. All patch schemas use `patchSchema()`,
  which strips defaults (found by an end-to-end test; covered by a unit test).

## Data

- Database: `~/Library/Application Support/LedgerOfAims/ledger.sqlite` (WAL mode,
  foreign keys on). Migrations are numbered SQL files applied in transactions, with
  an automatic snapshot before any migration of an existing database.
- Calendar dates are stored as `YYYY-MM-DD` strings and all date arithmetic uses
  whole day numbers, which is immune to daylight-saving changes.
- Weights are stored in kilograms; pounds are a display/entry preference.
- One weigh-in per day: logging again on the same date replaces the value.
- A database written by a _newer_ app version is never migrated backwards; the app
  shows the recovery screen instead.
- Recovery never deletes anything: damaged files are moved to
  `…/LedgerOfAims/quarantine/`.

## Seeded plan

- The plan starts on **15 October 2026** (the brief's "today"). "Today" in the app is
  the real system date; tests pin it with `LEDGER_NOW`.
- Brief dates given to the day are used verbatim (Quran milestones).
- Month-only "by" deadlines (game phases, degree completion) use the **last day of
  that month**, e.g. "by Apr 2027" → 30 Apr 2027.
- Physique checkpoints ("Oct 2027" etc.) are dated **15 October** each year — the
  anniversary of the plan start — so each segment is exactly one year at ≈4.9 kg.
- Degree completion ("about autumn 2029") is seeded as 31 Oct 2029 and labelled
  _expected_; no term dates are invented.
- Only the game goal is seeded with a "next single action"; the others start blank.

## Quran module

- **Page states.** "New" means _recently learned_ (still in its learning steps),
  "In revision" means _being relearnt after a lapse_, and pages not yet learned are
  shown blank ("not started"). Learned pages of any state count towards progress.
- **Pages, not juz, are the unit of scheduling.** Juz figures (rings, retention) are
  aggregates of their pages, and rating a whole juz rates each of its pages.
- **Mushaf layout.** The default is the 15-line Madani print's juz start pages
  (structural page numbers only); editable in Settings → Quran → Mushaf layout.
- **Backward memorisation** takes each juz from its first page, then moves to the
  previous juz (e.g. after juz 16–30, the next page is 282, the start of juz 15).
- **Milestones in juz → pages.** Converted exactly using the layout and the order in
  which juz will be completed (complete juz, then partly learned, then untouched juz
  in learning order). With juz 16–30 memorised, 20 juz = 404 pages.
- **Target line** runs from the pages learned before 15 Oct 2026 through each Quran
  milestone, linearly. "On track" means within ±2 pages (editable).
- **Rolling pace** blends in the declared baseline (5 pages/week) for days before
  tracking began, until 28 days of data exist; the screen says so.
- **Learning log** is derived from each page's learned date rather than a separate
  log table, so it can never disagree with the mushaf.
- **Revision streak** counts a day when at least one revision was recorded; one
  missed day in any seven is forgiven by default (editable).
- Quran milestones are completed automatically when reached but never un-completed
  automatically (an Undo of pages leaves the milestone as it is; untick it manually).
- Scheduler changes apply to future reviews; existing due dates are not rewritten.

## Physique module

- **Trajectory** runs from the onboarding weight and date through the four checkpoints
  (15 Oct each year), linearly. Real gains are not linear; the UI says so.
- **Trend, not scale**: rates, verdicts, calorie formulas and checkpoint completion all
  use the smoothed trend so a salty dinner never triggers anything.
- **Rate band**: on pace means within −0.10 / +0.15 kg a week of the plan's rate, and
  never above 0.5% of bodyweight a week (a common lean-gain ceiling). All editable.
- **Calories**: Mifflin–St Jeor × activity (1.55 default for cafe shifts plus training)
  when height, birth year and sex are given; otherwise 33 kcal per kg. +250 kcal
  surplus and 2.0 g/kg protein by default; manual overrides allowed.
- **Adherence score**: 50 points for calories (full within ±10%, zero beyond ±30%) and
  50 for protein (full at ≥ 90% of target). A day counts for the streak at 70+; one
  missed day in seven is forgiven. Past days are scored against current targets.
- **Logged food copies** the favourite's values, so editing a favourite never rewrites
  history. Starter favourites are labelled as approximations.
- **One workout per date**; a set's load for bodyweight exercises is the _added_ load.
- **Double progression** uses the heaviest load of the last session as its working
  sets (lighter warm-ups are ignored). Two consecutive sessions below the rep floor at
  the same load suggest a 10% deload rounded to the exercise's increment.
- **Photos** are re-encoded to JPEG on import (which strips EXIF location data and
  converts HEIC on macOS) and stored in `…/LedgerOfAims/photos/`. They are not stored
  in the database.

## Degree module

- **Classification maths**: module mark = weighted mean of graded assessments; level
  average = credit-weighted mean of module marks; final = level-weighted mean. Default
  weights L5 : L6 = 1 : 2, L4 not counted; boundaries 70/60/50/40. These are flagged in
  the app as unverified for Arden.
- **No rounding** beyond floating-point tolerance: 69.5 is a 2:1 here; universities
  that round or use borderline rules differ.
- **Projection** uses graded work only; the "what do I need" figure treats every
  ungraded assessment, every module without assessments, and every credit not yet
  entered (up to 120 a level) as remaining work.
- **Status follows grades**: entering a grade marks an assessment graded; clearing it
  returns it to submitted.
- **Deadlines** count as done once submitted or graded. Overdue items stay in the
  "next three" for 30 days.

## Game module

- **Seeded roadmap** of six phases with dependencies between key tasks; phases link to
  the seeded game milestones by title so they show the date they lead to. All of it is
  editable and none of it is a prescription.
- **Rollup** is weighted by estimated hours; tasks without an estimate count as the
  average of those with one (or equally when none have estimates), so adding a single
  estimate never distorts the whole.
- **One timer at a time**, stored as an open time entry (a partial unique index makes a
  second impossible), so it survives quitting, crashes and restarts.
- **Manual entries without a start time**: today's end now (time just spent); an
  earlier day's sit at midday, shifted earlier if needed to end by midnight.
- **Durations**: a bare number is minutes; `1.5h`, `1h30` and `1:30` are understood.
  The same parser will serve the quick-log grammar in Phase 7.
- **Focus session** is your judgement, ticked when stopping the timer or adding an
  entry; it is not inferred.
- **Hours chart** covers the weeks since the plan began (at least four, at most
  twelve); the average uses full weeks since the start only.
- **Devlog markdown** is GitHub-flavoured, with raw HTML ignored and images shown as
  their alt text — loading a remote image would be a network request.
- **Steam checklist**: item names plus "last known" values, each flagged _Verify
  against the current Steamworks documentation_; no fee, size or rule is presented as
  current or guaranteed.

## Planner rules (used by study proposals now, the full planner in Phase 6)

- Default sleep 8 h, wind-down 30 min, morning routine 30 min, commute 20 min each way,
  30 min recovery after a shift, days run 07:00–23:00.
- After a night shift ending 01:00, the next day starts at 10:20 (home 01:20, asleep
  01:50, up 09:50, routine). Before a 07:30 morning shift, plans end by 22:10.
- A night shift followed by a morning shift leaves 4 h 50 min for sleep and is flagged
  (threshold 7 h, editable).
- Study sessions fill days in date order, one per day per round, at most two a day.
- Plan blocks are generic (any goal) and stored now so Phase 6 builds on the same data.

## Privacy

- No network access at runtime, enforced by four layers: a session-level request
  guard that cancels and logs any outgoing request, a strict production CSP
  (`connect-src 'none'`), disabled Chromium background services and spellchecker
  downloads, and an ESLint ban on network APIs in `src/`.
- Links the user adds themselves (e.g. learning resources) open in the default
  browser on click. That is the user's browser making a request, not the app.

## Interface

- Headings use the macOS system serif (New York, via `ui-serif`); text uses SF Pro.
  No web fonts are bundled.
- Theme is applied through Electron's `nativeTheme.themeSource`, so vibrancy, the
  title bar and CSS `prefers-color-scheme` always agree.
- Goals are ordered by their letters everywhere: A Quran, B Game, C Degree,
  D Physique.
- Goal accents: Quran — deep teal; Physique — ochre; Degree — oxblood; Game —
  indigo. All text pairings meet WCAG AA in both themes (`npm run contrast`).
- Global quick-log shortcut default (Phase 7): **Ctrl+Shift+Space**, chosen to avoid
  Spotlight, VoiceOver (Ctrl+Option) and Finder conflicts.

## Pending your confirmation

- **Honours classification weighting** defaults to Level 5 : Level 6 = 1 : 2
  (Level 4 not counted). Arden's current regulations could not be verified offline;
  please confirm and adjust in Settings when the degree module lands.
