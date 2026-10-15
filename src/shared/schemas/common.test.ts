import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { patchSchema } from './common';
import { milestonePatchSchema } from './core';
import { settingsSchemas } from './settings';

describe('patchSchema', () => {
  it('keeps only the fields that were sent (no defaults)', () => {
    const schema = z.object({
      a: z.string().default('x'),
      b: z.number().default(1),
      c: z.string(),
    });
    expect(patchSchema(schema).parse({ c: 'k' })).toEqual({ c: 'k' });
    expect(patchSchema(schema).parse({})).toEqual({});
  });

  it('still validates the fields that were sent', () => {
    expect(() => patchSchema(settingsSchemas.general).parse({ weekStartsOn: 12 })).toThrow();
    expect(patchSchema(settingsSchemas.general).parse({ theme: 'dark' })).toEqual({
      theme: 'dark',
    });
  });

  it('protects milestone patches from resetting other fields', () => {
    const parsed = milestonePatchSchema.parse({ id: 'm1', patch: { title: 'Renamed' } });
    expect(parsed.patch).toEqual({ title: 'Renamed' });
  });
});
