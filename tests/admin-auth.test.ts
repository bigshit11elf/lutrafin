import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/lib/server/config/app-config';

describe('admin auth configuration', () => {
  const baseEnv = {
    APP_BASE_URL: 'http://localhost:3000',
    APP_PORT: '3000',
    DATABASE_PATH: './data/test.db',
    SYNC_INTERVAL: '6h',
    METADATA_REFRESH_INTERVAL: '24h',
    LOG_LEVEL: 'info'
  };

  it('rejects an empty admin username when configured', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: 'secret'
      })
    ).toThrow('ADMIN_USERNAME must not be empty');
  });

  it('rejects a whitespace-only admin username when configured', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        ADMIN_USERNAME: '   ',
        ADMIN_PASSWORD: 'secret'
      })
    ).toThrow('ADMIN_USERNAME must not be empty');
  });

  it('trims the configured admin username', () => {
    expect(
      loadConfig({
        ...baseEnv,
        ADMIN_USERNAME: ' admin ',
        ADMIN_PASSWORD: 'secret'
      }).admin
    ).toEqual({ username: 'admin', password: 'secret' });
  });

  it.each([
    ['true', true],
    ['false', false],
    ['1', true],
    ['0', false],
    ['yes', true],
    ['no', false],
    ['on', true],
    ['off', false]
  ])('parses boolean environment value %s', (value, expected) => {
    expect(
      loadConfig({
        ...baseEnv,
        TVMAZE_ENABLED: value,
        TVDB_ENABLED: value
      }).providers
    ).toMatchObject({ tvmazeEnabled: expected, tvdbEnabled: expected });
  });

  it('keeps optional HSTS disabled by default for HTTP home lab deployments', () => {
    expect(loadConfig(baseEnv).security.hstsEnabled).toBe(false);
  });

  it('allows optional HSTS to be enabled explicitly', () => {
    expect(
      loadConfig({ ...baseEnv, SECURITY_HSTS_ENABLED: 'true' }).security
        .hstsEnabled
    ).toBe(true);
  });
});
