import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

const durationSchema = z
  .string()
  .regex(/^\d+[mhd]$/, 'Use a duration like 30m, 6h, or 1d');

const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

const booleanEnvSchema = z
  .union([z.boolean(), z.string()])
  .transform((value, context) => {
    if (typeof value === 'boolean') return value;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Use true/false or 1/0'
    });
    return z.NEVER;
  });

const rawConfigSchema = z.object({
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  SOURCE_CODE_URL: z
    .string()
    .url()
    .default('https://github.com/bigshit11elf/lutrafin'),
  APP_PORT: z.coerce.number().int().positive().max(65535).default(3000),
  DATABASE_PATH: z.string().min(1).default('./data/app.db'),
  JELLYFIN_URL: z.string().url().optional(),
  JELLYFIN_TOKEN: z.string().optional(),
  JELLYFIN_TOKEN_FILE: z.string().optional(),
  JELLYFIN_EXCLUDED_LIBRARY_IDS: z.string().optional(),
  TMDB_API_TOKEN: z.string().optional(),
  TMDB_API_TOKEN_FILE: z.string().optional(),
  TVMAZE_ENABLED: booleanEnvSchema.default(true),
  TVDB_ENABLED: booleanEnvSchema.default(false),
  TVDB_API_TOKEN: z.string().optional(),
  TVDB_API_TOKEN_FILE: z.string().optional(),
  SYNC_INTERVAL: durationSchema.default('6h'),
  METADATA_REFRESH_INTERVAL: durationSchema.default('24h'),
  LOG_LEVEL: logLevelSchema.default('info'),
  SECURITY_HSTS_ENABLED: booleanEnvSchema.default(false),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_PASSWORD_FILE: z.string().optional()
});

export type AppConfig = {
  appBaseUrl: string;
  sourceCodeUrl: string;
  appPort: number;
  databasePath: string;
  jellyfin:
    | {
        url: string;
        token: string | undefined;
        excludedLibraryIds: string[];
      }
    | undefined;
  providers: {
    tmdbApiToken: string | undefined;
    tvmazeEnabled: boolean;
    tvdbEnabled: boolean;
    tvdbApiToken: string | undefined;
  };
  syncInterval: string;
  metadataRefreshInterval: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  security: {
    hstsEnabled: boolean;
  };
  admin:
    | {
        username: string;
        password: string;
      }
    | undefined;
};

function readSecret(
  value: string | undefined,
  filePath: string | undefined
): string | undefined {
  if (value && value.trim().length > 0) {
    return value.trim();
  }

  if (!filePath || filePath.trim().length === 0) {
    return undefined;
  }

  if (!existsSync(filePath)) {
    throw new Error(`Secret file does not exist: ${filePath}`);
  }

  const secret = readFileSync(filePath, 'utf8').trim();
  return secret.length > 0 ? secret : undefined;
}

function splitList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

let cachedConfig: AppConfig | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cachedConfig && env === process.env) {
    return cachedConfig;
  }

  const raw = rawConfigSchema.parse(env);
  const adminUsername = raw.ADMIN_USERNAME?.trim();
  if (raw.ADMIN_USERNAME !== undefined && !adminUsername) {
    throw new Error('ADMIN_USERNAME must not be empty when set.');
  }

  const config = {
    appBaseUrl: raw.APP_BASE_URL,
    sourceCodeUrl: raw.SOURCE_CODE_URL,
    appPort: raw.APP_PORT,
    databasePath: raw.DATABASE_PATH,
    jellyfin: raw.JELLYFIN_URL
      ? {
          url: raw.JELLYFIN_URL,
          token: readSecret(raw.JELLYFIN_TOKEN, raw.JELLYFIN_TOKEN_FILE),
          excludedLibraryIds: splitList(raw.JELLYFIN_EXCLUDED_LIBRARY_IDS)
        }
      : undefined,
    providers: {
      tmdbApiToken: readSecret(raw.TMDB_API_TOKEN, raw.TMDB_API_TOKEN_FILE),
      tvmazeEnabled: raw.TVMAZE_ENABLED,
      tvdbEnabled: raw.TVDB_ENABLED,
      tvdbApiToken: readSecret(raw.TVDB_API_TOKEN, raw.TVDB_API_TOKEN_FILE)
    },
    syncInterval: raw.SYNC_INTERVAL,
    metadataRefreshInterval: raw.METADATA_REFRESH_INTERVAL,
    logLevel: raw.LOG_LEVEL,
    security: {
      hstsEnabled: raw.SECURITY_HSTS_ENABLED
    },
    admin: adminUsername
      ? {
          username: adminUsername,
          password:
            readSecret(raw.ADMIN_PASSWORD, raw.ADMIN_PASSWORD_FILE) ?? ''
        }
      : undefined
  };

  if (config.jellyfin?.url && !config.jellyfin.token) {
    throw new Error(
      'JELLYFIN_TOKEN or JELLYFIN_TOKEN_FILE is required when JELLYFIN_URL is set.'
    );
  }

  if (config.admin && !config.admin.password) {
    throw new Error(
      'ADMIN_PASSWORD or ADMIN_PASSWORD_FILE is required when ADMIN_USERNAME is set.'
    );
  }

  if (env === process.env) {
    cachedConfig = config;
  }

  return config;
}

export function durationToMs(value: string): number {
  const amount = Number.parseInt(value.slice(0, -1), 10);
  const unit = value.slice(-1);

  switch (unit) {
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 60 * 60_000;
    case 'd':
      return amount * 24 * 60 * 60_000;
    default:
      throw new Error(`Unsupported duration: ${value}`);
  }
}
