import { dialog, nativeImage, type BrowserWindow } from 'electron';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Photo } from '@shared/schemas/physique';
import { DomainError } from '../errors';
import type { RepoContext } from '../db/repositories/context';
import { newId } from '../db/repositories/context';
import { deletePhotoRow, insertPhoto, photoFileName } from '../db/repositories/photos';

/**
 * Progress photos are copied into the private data folder (never referenced in
 * place), re-encoded as JPEG — which also converts iPhone HEIC files on macOS — and
 * given a small thumbnail for the grid. EXIF metadata is not carried over.
 */
export function photoPaths(photosDir: string, fileName: string) {
  return {
    full: join(photosDir, fileName),
    thumb: join(photosDir, fileName.replace(/\.jpg$/, '.thumb.jpg')),
  };
}

export async function importPhotos(
  ctx: RepoContext,
  photosDir: string,
  win: BrowserWindow | null,
  meta: { date: string; pose: string; note: string },
): Promise<Photo[]> {
  const options = {
    title: 'Add progress photos',
    properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'] }],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return [];
  mkdirSync(photosDir, { recursive: true });
  const added: Photo[] = [];
  for (const source of result.filePaths) {
    const image = nativeImage.createFromPath(source);
    if (image.isEmpty()) {
      throw new DomainError(
        'CONFLICT',
        `This image format could not be read: ${source.split(/[\\/]/).pop() ?? source}`,
      );
    }
    const id = newId();
    const fileName = `${id}.jpg`;
    const paths = photoPaths(photosDir, fileName);
    writeFileSync(paths.full, image.toJPEG(90));
    const { width } = image.getSize();
    writeFileSync(
      paths.thumb,
      (width > 480 ? image.resize({ width: 480, quality: 'good' }) : image).toJPEG(82),
    );
    added.push(insertPhoto(ctx, { id, ...meta, fileName }));
  }
  return added;
}

export function resolvePhotoFile(
  ctx: RepoContext,
  photosDir: string,
  id: string,
  variant: 'full' | 'thumb',
): string | null {
  const name = photoFileName(ctx, id);
  if (!name) return null;
  const paths = photoPaths(photosDir, name);
  return variant === 'thumb' && existsSync(paths.thumb) ? paths.thumb : paths.full;
}

export function deletePhoto(ctx: RepoContext, photosDir: string, id: string): void {
  const name = deletePhotoRow(ctx, id);
  const paths = photoPaths(photosDir, name);
  rmSync(paths.full, { force: true });
  rmSync(paths.thumb, { force: true });
}
