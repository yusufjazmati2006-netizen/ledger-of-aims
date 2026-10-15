# Ledger of Aims

A calm, private, local-first macOS app for four long-term goals — Quran
memorisation, a first game on Steam, a business management degree, and an 86 kg
physique — planned around a cafe shift pattern.

Everything stays on your Mac. No accounts, no cloud, no telemetry, no network.

> **Status:** Phases 1–3 of 9 are complete (foundations; Quran; Physique). See [CHANGELOG.md](CHANGELOG.md)
> for what works today and [TODO.md](TODO.md) for what is still to come.

## Quick start (developers)

Requires Node.js 22.12 or newer.

```sh
npm install
npm start        # builds and launches the app
```

Other scripts:

| Script             | Purpose                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| `npm run dev`      | Launch with hot reload (uses a local Vite dev server).                        |
| `npm test`         | Unit tests (Vitest): domain logic, migrations, repositories, IPC.             |
| `npm run test:e2e` | Build, then drive the real app with Playwright.                               |
| `npm run check`    | Typecheck, lint, format check and unit tests together.                        |
| `npm run contrast` | Verify every colour pairing meets WCAG AA.                                    |
| `npm run icons`    | Regenerate the app and menu-bar icons from `build/*.svg`.                     |
| `npm run dist`     | Build the universal (Apple silicon + Intel) `.dmg` and `.app` (run on a Mac). |

## Where your data lives

| What                            | Where                                                      |
| ------------------------------- | ---------------------------------------------------------- |
| Database                        | `~/Library/Application Support/LedgerOfAims/ledger.sqlite` |
| Quarantined (damaged) databases | `~/Library/Application Support/LedgerOfAims/quarantine/`   |
| Backups (Phase 8)               | `~/Documents/LedgerOfAims Backups/`                        |

**Settings → Data & privacy → Reveal** opens the data folder.

If the database is ever damaged, Ledger of Aims opens a recovery screen instead of
the app. From there you can restore a backup, or start fresh. Either way, the damaged
file is moved aside rather than deleted.

## Architecture (summary)

- **Main process** (`src/main`) owns the SQLite database (better-sqlite3), migrations,
  seeding, recovery, the network guard, the window and the menus.
- **Preload** (`src/preload`) exposes one typed `invoke` and an event subscription;
  the renderer is sandboxed with no Node access.
- **Shared** (`src/shared`) holds the IPC contract (Zod-validated), schemas, seed
  data and pure domain logic. This is where the unit tests concentrate.
- **Renderer** (`src/renderer`): React 19, Tailwind CSS 4 design tokens, Zustand.

[DECISIONS.md](DECISIONS.md) records the reasoning behind each choice.

## Privacy: how "no network" is enforced and verified

1. Every outgoing request is cancelled at the Electron session level and logged
   (`src/main/network-guard.ts`). **Settings → Data & privacy** shows the count.
2. A strict production Content-Security-Policy (`connect-src 'none'`).
3. Chromium background networking, component updates and spellchecker downloads are
   disabled.
4. ESLint forbids network APIs (`fetch`, `XMLHttpRequest`, `http`, `net`, …) in `src/`.

The end-to-end tests assert that the guard's log is empty after exercising the app.
To check independently on a Mac, run `nettop -p "$(pgrep -f 'Ledger of Aims' | head -1)"`
while using the app, or watch it with a firewall such as Little Snitch or LuLu.

## First launch on macOS (unsigned build)

The app is not signed with an Apple Developer certificate, so Gatekeeper will
hesitate the first time:

1. Drag **Ledger of Aims** from the `.dmg` into **Applications**.
2. In Applications, **right-click (or Control-click) the app → Open**, then confirm
   **Open**. You only need to do this once.
3. If macOS still refuses, open **System Settings → Privacy & Security**, scroll to
   the message about Ledger of Aims, and choose **Open Anyway**.
