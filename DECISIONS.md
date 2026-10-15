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
- Goal accents: Quran — deep teal; Physique — ochre; Degree — oxblood; Game —
  indigo. All text pairings meet WCAG AA in both themes (`npm run contrast`).
- Global quick-log shortcut default (Phase 7): **Ctrl+Shift+Space**, chosen to avoid
  Spotlight, VoiceOver (Ctrl+Option) and Finder conflicts.

## Pending your confirmation

- **Honours classification weighting** defaults to Level 5 : Level 6 = 1 : 2
  (Level 4 not counted). Arden's current regulations could not be verified offline;
  please confirm and adjust in Settings when the degree module lands.
