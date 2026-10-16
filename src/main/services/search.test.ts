import { describe, expect, it } from 'vitest';
import { createTestContext } from '../db/testing';
import { saveDevlog } from '../db/repositories/game';
import { ftsQuery, invalidateSearch, search } from './search';

describe('search', () => {
  it('turns typed words into safe prefix queries', () => {
    expect(ftsQuery('Paddle movement')).toBe('"paddle"* "movement"*');
    expect(ftsQuery('"OR" NEAR(a b) -x')).toBe('"or"* "near"* "a"* "b"* "x"*');
    expect(ftsQuery('  …  ')).toBeNull();
  });

  it('finds seeded and written content by prefix, with highlighted snippets', () => {
    const ctx = createTestContext();
    saveDevlog(ctx, {
      date: '2026-10-15',
      title: 'Week one',
      body: 'The paddles finally feel responsive after tuning acceleration.',
      tags: ['pong'],
    });
    invalidateSearch();
    const hits = search(ctx, 'paddl');
    expect(hits[0]).toMatchObject({ kind: 'devlog', path: '/game/devlog', title: 'Week one' });
    expect(hits[0]?.snippet).toContain('\u0001paddles\u0002');
    // Tags, seeded milestones and accented text are searchable too.
    expect(search(ctx, 'pong').some((h) => h.kind === 'devlog')).toBe(true);
    expect(search(ctx, '20 juz').some((h) => h.kind === 'milestone')).toBe(true);
    expect(search(ctx, 'xylophone')).toEqual([]);
    saveDevlog(ctx, {
      date: '2026-10-15',
      title: 'Café shift',
      body: 'Murajaʿah on the break.',
      tags: [],
    });
    invalidateSearch();
    expect(search(ctx, 'cafe')[0]?.title).toBe('Café shift');
    expect(search(ctx, 'murajaʿah')[0]?.title).toBe('Café shift');
    expect(search(ctx, 'murajaah')[0]?.title).toBe('Café shift');
  });
});
