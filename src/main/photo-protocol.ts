import { protocol } from 'electron';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

export const PHOTO_SCHEME = 'ledger-photo';

/** Must run before `app` is ready. */
export function registerPhotoScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: PHOTO_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Serves progress photos from the private data folder as
 * `ledger-photo://<id>/full` and `ledger-photo://<id>/thumb`. Only files the
 * database knows about are served; nothing else on disk is reachable.
 */
export function handlePhotoProtocol(
  resolve: (id: string, variant: 'full' | 'thumb') => string | null,
): void {
  protocol.handle(PHOTO_SCHEME, async (request) => {
    const url = new URL(request.url);
    const variant = url.pathname.replace(/^\//, '') === 'thumb' ? 'thumb' : 'full';
    const file = resolve(url.hostname, variant);
    if (!file) return new Response('Not found', { status: 404 });
    try {
      const data = await readFile(file);
      return new Response(new Uint8Array(data), {
        headers: {
          'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
