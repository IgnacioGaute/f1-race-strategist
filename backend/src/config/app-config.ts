import { existsSync } from 'node:fs';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface F1ApiConfig {
  baseUrl: string;
  /** Total budget per provider query, retries and waits included. */
  timeoutMs: number;
}

/**
 * Keeps the provider budget below the frontend's own request timeout (90 s in
 * frontend/src/lib/api.ts), so the browser still receives our 504.
 */
const F1_API_TIMEOUT_MAX_MS = 80_000;

export interface AppConfig {
  port: number;
  corsOrigins: string[];
  f1Api: F1ApiConfig;
  database: DatabaseConfig;
}

type Env = Record<string, string | undefined>;

/** Loads `.env` from the working directory when present. Real env vars take precedence. */
export function loadEnvFileIfPresent(path = '.env'): void {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}

class EnvReader {
  readonly problems: string[] = [];

  constructor(private readonly env: Env) {}

  string(name: string): string {
    const value = this.env[name]?.trim();
    if (!value) {
      this.problems.push(`${name} is required`);
      return '';
    }
    return value;
  }

  integer(name: string, min: number, max: number): number {
    const raw = this.string(name);
    if (!raw) return 0;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      this.problems.push(
        `${name} must be an integer between ${min} and ${max}`,
      );
    }
    return value;
  }

  throwIfInvalid(): void {
    if (this.problems.length > 0) {
      throw new Error(`Invalid configuration: ${this.problems.join('; ')}`);
    }
  }
}

function readDatabaseConfig(reader: EnvReader): DatabaseConfig {
  return {
    host: reader.string('DB_HOST'),
    port: reader.integer('DB_PORT', 1, 65535),
    username: reader.string('DB_USER'),
    password: reader.string('DB_PASSWORD'),
    database: reader.string('DB_NAME'),
  };
}

export function loadDatabaseConfig(env: Env): DatabaseConfig {
  const reader = new EnvReader(env);
  const config = readDatabaseConfig(reader);
  reader.throwIfInvalid();
  return config;
}

export function loadAppConfig(env: Env): AppConfig {
  const reader = new EnvReader(env);
  const config: AppConfig = {
    port: reader.integer('PORT', 1, 65535),
    corsOrigins: reader
      .string('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    f1Api: {
      baseUrl: reader.string('F1_API_BASE_URL').replace(/\/+$/, ''),
      timeoutMs: reader.integer(
        'F1_API_TIMEOUT_MS',
        1_000,
        F1_API_TIMEOUT_MAX_MS,
      ),
    },
    database: readDatabaseConfig(reader),
  };
  reader.throwIfInvalid();
  return config;
}
