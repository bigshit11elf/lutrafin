import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '../src/lib/server/http/redirects';

describe('safeRedirectPath', () => {
  it.each([
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    'settings'
  ])('rejects unsafe redirect %s', (value) => {
    expect(safeRedirectPath(value, '/fallback')).toBe('/fallback');
  });

  it.each(['/', '/settings', '/series/abc?returnTo=%2F'])(
    'allows local path %s',
    (value) => {
      expect(safeRedirectPath(value, '/fallback')).toBe(value);
    }
  );
});
