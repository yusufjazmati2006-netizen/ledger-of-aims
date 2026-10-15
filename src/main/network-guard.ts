import type { Session } from 'electron';

const LOCAL_SCHEMES = [
  'file:',
  'devtools:',
  'data:',
  'blob:',
  'ledger-photo:',
  'chrome:',
  'about:',
];

export interface NetworkGuard {
  blocked(): { url: string; at: string }[];
}

/**
 * Cancels every request that would leave the machine and records the attempt.
 *
 * Ledger of Aims performs no network I/O by design; this guard turns that design
 * into an enforced property. The only exception is the local Vite dev server when
 * running `npm run dev`. The log is exposed in Settings → Privacy and asserted to be
 * empty by the end-to-end tests.
 */
export function installNetworkGuard(session: Session, devServerUrl?: string): NetworkGuard {
  const log: { url: string; at: string }[] = [];
  const devOrigin = devServerUrl ? new URL(devServerUrl) : null;

  session.webRequest.onBeforeRequest((details, callback) => {
    const { url } = details;
    if (LOCAL_SCHEMES.some((scheme) => url.startsWith(scheme))) {
      callback({});
      return;
    }
    if (devOrigin) {
      try {
        const target = new URL(url);
        if (target.hostname === devOrigin.hostname && target.port === devOrigin.port) {
          callback({});
          return;
        }
      } catch {
        // fall through to blocking
      }
    }
    log.push({ url, at: new Date().toISOString() });
    console.warn(`[network-guard] blocked ${url}`);
    callback({ cancel: true });
  });

  // No spellchecker dictionaries are ever downloaded.
  session.setSpellCheckerEnabled(false);

  return { blocked: () => [...log] };
}
