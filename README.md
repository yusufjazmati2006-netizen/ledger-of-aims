# Ledger of Aims

A calm, private, local-first macOS app for four long-term goals — Quran
memorisation, a first game on Steam, a business management degree, and an 86 kg
physique — planned around a cafe shift pattern (07:30–16:30 or 16:00–01:00).

Everything stays on your Mac. No accounts, no cloud, no telemetry, no network.

> **Status:** all nine planned phases are built and tested. The universal macOS
> `.dmg` is produced by the GitHub Actions workflow in `.github/workflows/mac-dist.yml`
> (or by `npm run dist` on a Mac). See [CHANGELOG.md](CHANGELOG.md) for what each
> version added and [TODO.md](TODO.md) for known gaps.

- [What it does](#what-it-does)
- [Install on your Mac](#install-on-your-mac)
- [Everyday use](#everyday-use)
- [Your data: where it lives, backups and restore](#your-data)
- [Privacy: how “no network” is enforced and verified](#privacy)
- [Development](#development)
- [Building and releasing the Mac app](#building-and-releasing-the-mac-app)
- [Troubleshooting](#troubleshooting)

## What it does

| Goal                | Highlights                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A · Quran**       | 604-page mushaf grid and juz rings; a transparent, tunable spaced-repetition muraja'ah queue sized to your time; pace against the 20 / 25 / 30 juz milestones. No theological content — only page numbers and your notes.          |
| **B · Game**        | Roadmap with dependencies and estimate-weighted progress; learning path and engine decisions; practice board; a timer that survives restarts; weekly hours; a markdown devlog; a Steam readiness checklist flagged “verify”.       |
| **C · Degree**      | Years, modules, assessments and a deadline calendar; UK honours projection and “what do I need?”; escalating countdowns; study planned around shifts.                                                                              |
| **D · Physique**    | EWMA weight trend against the checkpoint trajectory with too-fast / too-slow warnings; double-progression workouts and PRs; nutrition targets with the formula shown; meal prep; progress photos side by side. Not medical advice. |
| **Across all four** | Today’s focus sized to the free time your shifts leave; a shift-aware weekly planner with drag-to-adjust; the Sunday review; forgiving streaks; quick log from anywhere; reminders that respect shifts and sleep; backups; search. |

## Install on your Mac

1. Download `Ledger-of-Aims-<version>-universal.dmg` from the latest run of the
   **macOS app** workflow (Actions tab → run → Artifacts), or from a GitHub release.
   It runs natively on Apple silicon and Intel Macs (macOS 13 or later).
2. Open the `.dmg` and drag **Ledger of Aims** into **Applications**.

### First launch (unsigned build)

The app is not signed with an Apple Developer certificate, so Gatekeeper hesitates the
first time:

1. In Applications, **right-click (or Control-click) Ledger of Aims → Open**, then
   confirm **Open**. You only need to do this once.
2. If macOS still refuses, open **System Settings → Privacy & Security**, scroll to the
   message about Ledger of Aims and choose **Open Anyway**.

On first run, a short onboarding asks for your starting weight, which juz you have
memorised, and this week's shifts. The goals and milestones from the plan (starting
15 October 2026) are already there, and everything is editable.

**Worth doing once:** Settings → Menu bar & shortcut → **Open at login**, so reminders
and the daily backup happen even on days you don't open the app; and allow
notifications when macOS asks (or later in System Settings → Notifications).

## Everyday use

### Logging in a few seconds

Press **Ctrl+Shift+Space** from any app (change it in Settings → Menu bar & shortcut),
or **⌘K** inside the app, type a line and press Return:

| Type           | Logs                                                        |
| -------------- | ----------------------------------------------------------- |
| `w 72.4`       | today's weight (your display unit, or add `kg` / `lb`)      |
| `p 3`          | the next 3 pages in your memorisation order                 |
| `p 322-324`    | those pages as learned                                      |
| `r 1-20 solid` | a revision rating (`solid`, `shaky`, `forgotten`) for pages |
| `r j17 shaky`  | a rating for a whole juz                                    |
| `s 1.5h essay` | study time, with an optional note                           |
| `g 45m`        | game time; `g start` / `g stop` run the timer               |
| `wo`           | opens today's workout                                       |
| `h phone`      | ticks the habit whose name contains "phone"                 |

Durations accept `45m`, `1.5h`, `1h30` and `1:30`; a bare number under 10 means hours.
Typing words instead jumps to a screen ("plan", "nutrition", "steam"…) or searches
what you have written. The menu-bar item offers the same quick log and starts or stops
the game timer, showing its running time.

### Keyboard shortcuts

| Keys             | Does                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- |
| ⌘1 … ⌘9          | Today, Quran, Game, Degree, Physique, Planner, Weekly review, Milestones, Search      |
| ⌘K               | Command palette: quick log, go to any screen, search                                  |
| ⌘,               | Settings                                                                              |
| Ctrl+Shift+Space | Quick log from any app (configurable)                                                 |
| Planner blocks   | Space to pick up, arrows to move by 15 minutes or a day, Space to drop, Enter to edit |
| Mushaf grid      | Arrows to move, Shift+arrows to extend a selection, Home / End within a juz           |

Every screen is usable from the keyboard and has been checked with axe for WCAG 2.2
A/AA, in light and dark themes.

<a id="your-data"></a>

## Your data: where it lives, backups and restore

| What                            | Where                                                             |
| ------------------------------- | ----------------------------------------------------------------- |
| Database                        | `~/Library/Application Support/LedgerOfAims/ledger.sqlite`        |
| Progress photos                 | `~/Library/Application Support/LedgerOfAims/photos/`              |
| Quarantined (damaged) databases | `~/Library/Application Support/LedgerOfAims/quarantine/`          |
| Backups (daily, last 30 kept)   | `~/Documents/LedgerOfAims Backups/` (changeable in Settings)      |
| Backup folder setting           | `~/Library/Application Support/LedgerOfAims/backup-location.json` |

**Settings → Data & privacy → Reveal** opens the data folder.

### Backup and restore

- A backup is made automatically on each day you use the app; the last 30 are kept,
  and progress photos are mirrored beside them. **Settings → Backups → Back up now**
  makes one on demand; **Change…** moves backups to an external drive or a synced
  folder such as iCloud Drive.
- **Restore…** next to any backup (or **Restore from a file…**) replaces your data
  with it. Your current data is saved first as a “Before a restore” backup, so a
  restore can always be undone.
- **Settings → Export & import** saves everything as one JSON file (optionally with
  photos) and imports such a file after showing what will change, table by table. An
  import is also preceded by a backup.
- **Export to Calendar** writes an `.ics` file of milestones, deadlines, and the next
  eight weeks of plan blocks and shifts for Apple Calendar.

### If something goes wrong

If the database is ever damaged, Ledger of Aims opens a recovery screen instead of the
app. It lists your backups — from whichever folder you chose — so you can restore one,
or start fresh. Either way the damaged file is moved to `quarantine/`, never deleted.
Before any database upgrade, the app also takes a “Before an update” backup.

<a id="privacy"></a>

## Privacy: how “no network” is enforced and verified

**Enforced** in four independent layers:

1. Every outgoing request is cancelled at the Electron session level and logged
   (`src/main/network-guard.ts`); **Settings → Data & privacy** shows the count.
2. A strict production Content-Security-Policy (`connect-src 'none'`).
3. Chromium background networking, component updates and spellchecker downloads are
   switched off; there is no auto-updater and no crash reporter.
4. ESLint forbids network APIs (`fetch`, `XMLHttpRequest`, `WebSocket`, `http`, `net`, …)
   in `src/`.

Links you add yourself (e.g. a tutorial on your learning path) open in your browser
when you click them; the app itself never requests them.

**Verified** by tests, not just by design:

- Every end-to-end test, when it closes the app, asserts that the network guard
  blocked nothing.
- `npm run test:offline` (Linux) runs the entire end-to-end suite in a network
  namespace with no interfaces but loopback — no route to anywhere — and it passes.

To check for yourself on a Mac, watch the app with a firewall such as LuLu or Little
Snitch, or run `nettop -p "$(pgrep -f 'Ledger of Aims' | head -1)"` while using it.

## Development

Requires Node.js 22.12 or newer.

```sh
npm install
npm start        # builds and launches the app
```

| Script                 | Purpose                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`          | Launch with hot reload (local Vite dev server).                                   |
| `npm run check`        | Typecheck, lint, format check and unit tests together.                            |
| `npm test`             | Unit tests (Vitest): domain logic, migrations, repositories, services.            |
| `npm run test:e2e`     | Build, then drive the real app with Playwright (use `xvfb-run -a` on Linux).      |
| `npm run test:offline` | The end-to-end suite with networking removed (Linux, needs `unshare` and Xvfb).   |
| `npm run contrast`     | Verify every colour pairing meets WCAG AA in both themes.                         |
| `npm run icons`        | Regenerate the app and menu-bar icons from `build/*.svg`.                         |
| `npm run dist`         | Build the universal (Apple silicon + Intel) `.dmg`, `.zip` and `.app` (on a Mac). |
| `npm run dist:linux`   | Package an unpacked Linux build — a packaging check used during development.      |

Set `LEDGER_E2E_EXECUTABLE=/path/to/packaged/binary` to run the end-to-end suite
against a packaged app instead of the development build. Tests always use temporary
data folders (`LEDGER_USER_DATA`, `LEDGER_BACKUP_DIR`) and a pinned clock (`LEDGER_NOW`).

### Architecture

```
src/
  shared/      isomorphic and pure — no Electron or Node imports
    ipc/       the typed IPC contract (Zod input schemas, output types, mutated domains)
    schemas/   data shapes and settings
    domain/    the logic: quran, physique, degree, game, planner, today, streaks,
               notifications, quicklog, ics, time — where most unit tests live
    seed/      the plan's goals, milestones and starter content
  main/        Electron main process
    db/        better-sqlite3 connection, migrations (001–009), repositories, seeding
    services/  backups, restore, export/import, search (FTS5), notifications, photos
    ipc/       dispatch (validates every call against the contract) and handlers
    index.ts   app lifecycle, windows, menu, menu-bar item, global shortcut, recovery
  preload/     exposes one typed `invoke` and an event subscription — nothing else
  renderer/    React 19 + Tailwind CSS 4 design tokens + Zustand; screens under features/
tests/e2e/     Playwright end-to-end flows, accessibility audit, performance budgets
```

- The renderer is sandboxed with no Node access; every call goes through `invoke`,
  is validated with Zod in the main process, and data changes are broadcast so every
  window (including the quick-log window) stays current.
- Dates are local calendar dates and times are minutes after midnight, so DST and
  night shifts that end after midnight cannot break the arithmetic.
- Screens are loaded on first visit, so start-up parses only the shell and Today.

[DECISIONS.md](DECISIONS.md) records the reasoning behind each choice, including the
formulas (spaced repetition, trend, classification, planning, prioritisation).

### Tests

- **Unit** (Vitest): the domain logic, every repository, migrations, backups and
  export/import, search and query plans (each hot query must use an index).
- **End-to-end** (Playwright driving Electron): onboarding and persistence, each goal's
  main flows, the planner with keyboard dragging, the review, quick log and the floating
  window, notifications, backups and restore, recovery from a damaged database, export
  and import, search.
- **Accessibility**: axe (WCAG 2.2 A/AA) on every screen in light and dark.
- **Performance budgets**: cold start to a populated Today, the 604-cell mushaf, the
  planner (measured in the Linux development container: about 0.6 s, 0.15 s and 0.1 s).

## Building and releasing the Mac app

Two GitHub Actions workflows are included:

- **CI** (`.github/workflows/ci.yml`) — on every push and pull request: typecheck,
  lint, formatting, unit tests, contrast, and the end-to-end suite under Xvfb.
- **macOS app** (`.github/workflows/mac-dist.yml`) — run it from the Actions tab
  (**Run workflow**) or push a tag such as `v1.0.0`. On a Mac runner it runs the checks
  and the end-to-end suite, builds the universal `.dmg` and `.zip`, verifies that the
  app contains both architectures, smoke-tests the packaged app, and uploads it as an
  artifact. For a tag it also attaches the files to a GitHub release.

To build on your own Mac instead: `npm install && npm run dist`; the output is in
`release/<version>/`.

## Troubleshooting

- **The quick-log shortcut does nothing.** Another app may already use it; Settings →
  Menu bar & shortcut shows “In use by another app”. Record a different one there.
- **No reminders appear.** Check System Settings → Notifications → Ledger of Aims, and
  that the app is running (it can stay in the menu bar). Settings → Notifications has a
  **Send a test notification** button. Reminders also wait during shifts, quiet hours
  and the sleep window after a night shift — by design.
- **“The last backup failed”** in Settings usually means the backup folder is on a
  drive that is not connected. Reconnect it, or choose **Use default**.
- **The app opened a recovery screen.** The database could not be opened. Restore the
  newest backup from the list; nothing is deleted either way.
