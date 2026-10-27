import { Inject, Injectable, Logger } from '@nestjs/common';
import type { F1ApiConfig } from '../config/app-config';
import { F1ApiError, describeError } from './f1-api.error';
import {
  InvalidShapeError,
  parseCircuit,
  parseDriver,
  parseList,
  parseRace,
  parseRaceDetails,
  parseSimulationParameters,
  parseTeam,
  parseTyre,
  parseWeatherForecast,
  unwrapData,
} from './f1-api.parsers';
import type {
  Circuit,
  Driver,
  Race,
  RaceDetails,
  SimulationParameters,
  Team,
  Tyre,
  WeatherForecast,
} from './f1-api.types';

export const F1_API_CONFIG = Symbol('F1_API_CONFIG');

/** The provider is read-only and deterministic, so successful answers can be reused. */
const RESPONSE_CACHE_TTL_MS = 5 * 60_000;
/**
 * One retry, only for failures that typically mean "waking up / overloaded".
 * Our own timeout is not retried: it already used up the whole budget.
 */
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;
/** A retry is only started if, after the wait, at least this much budget is left. */
const MIN_RETRY_ATTEMPT_MS = 5_000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

interface CacheEntry {
  expiresAt: number;
  body: Promise<unknown>;
}

@Injectable()
export class F1ApiClient {
  private readonly logger = new Logger(F1ApiClient.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(@Inject(F1_API_CONFIG) private readonly config: F1ApiConfig) {}

  getRaces(): Promise<Race[]> {
    return this.get('/api/races', (data) =>
      parseList(data, 'races', parseRace),
    );
  }

  getCircuits(): Promise<Circuit[]> {
    return this.get('/api/circuits', (data) =>
      parseList(data, 'circuits', parseCircuit),
    );
  }

  getTeams(): Promise<Team[]> {
    return this.get('/api/teams', (data) =>
      parseList(data, 'teams', parseTeam),
    );
  }

  getDrivers(): Promise<Driver[]> {
    return this.get('/api/drivers', (data) =>
      parseList(data, 'drivers', parseDriver),
    );
  }

  getTyres(): Promise<Tyre[]> {
    return this.get('/api/tyres', (data) =>
      parseList(data, 'tyres', parseTyre),
    );
  }

  getRace(raceId: string): Promise<RaceDetails> {
    return this.get(`/api/races/${encodeURIComponent(raceId)}`, (data) =>
      parseRaceDetails(data, 'data'),
    );
  }

  getWeather(raceId: string): Promise<WeatherForecast> {
    return this.get(
      `/api/races/${encodeURIComponent(raceId)}/weather`,
      (data) => parseWeatherForecast(data, 'data'),
    );
  }

  getSimulationParameters(raceId: string): Promise<SimulationParameters> {
    return this.get(
      `/api/races/${encodeURIComponent(raceId)}/simulation-parameters`,
      (data) => parseSimulationParameters(data, 'data'),
    );
  }

  private async get<T>(
    path: string,
    parse: (data: Record<string, unknown>) => T,
  ): Promise<T> {
    const body = await this.cachedBody(path);
    try {
      return parse(unwrapData(body));
    } catch (error) {
      if (!(error instanceof InvalidShapeError)) throw error;
      this.cache.delete(path);
      this.logger.error(
        `F1 API GET ${path} returned an unexpected payload: ${error.message}`,
      );
      throw new F1ApiError(
        'invalid_response',
        path,
        `Unexpected payload from ${path}`,
        { cause: error },
      );
    }
  }

  /**
   * Concurrent callers share the same in-flight request, which avoids a burst of
   * identical requests while the provider is waking up. Failures are not cached.
   */
  private cachedBody(path: string): Promise<unknown> {
    const now = Date.now();
    const cached = this.cache.get(path);
    if (cached && cached.expiresAt > now) return cached.body;

    const body = this.requestWithRetry(path);
    this.cache.set(path, { expiresAt: now + RESPONSE_CACHE_TTL_MS, body });
    body.catch(() => {
      if (this.cache.get(path)?.body === body) this.cache.delete(path);
    });
    return body;
  }

  /**
   * `timeoutMs` is the budget for the whole query: every attempt and the wait
   * between them. Each attempt only gets what is left of it.
   */
  private async requestWithRetry(path: string): Promise<unknown> {
    const deadline = Date.now() + this.config.timeoutMs;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.request(path, deadline - Date.now());
      } catch (error) {
        if (!(error instanceof F1ApiError)) throw error;
        const retryable = attempt < MAX_ATTEMPTS && isRetryable(error);
        const budgetLeft =
          deadline - Date.now() >= RETRY_DELAY_MS + MIN_RETRY_ATTEMPT_MS;
        if (retryable && budgetLeft) {
          await delay(RETRY_DELAY_MS);
          continue;
        }
        // A 404 is an expected answer (unknown race), not an operational problem.
        if (error.kind !== 'not_found') {
          const status = error.status ? ` ${error.status}` : '';
          const skipped = retryable ? ', no budget left to retry' : '';
          this.logger.warn(
            `F1 API GET ${path} failed after ${attempt} attempt(s) (${error.kind}${status}${skipped}): ${describeError(error.cause ?? error)}`,
          );
        }
        throw error;
      }
    }
  }

  private async request(path: string, timeoutMs: number): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw toTransportError(error, path, timeoutMs);
    }

    if (response.status === 404) {
      throw new F1ApiError('not_found', path, `${path} not found`, {
        status: 404,
      });
    }
    if (!response.ok) {
      throw new F1ApiError(
        'http_error',
        path,
        `${path} answered ${response.status}`,
        { status: response.status },
      );
    }

    try {
      const body: unknown = await response.json();
      return body;
    } catch (error) {
      if (isTimeout(error)) {
        throw toTransportError(error, path, timeoutMs);
      }
      throw new F1ApiError('invalid_response', path, `${path} is not JSON`, {
        cause: error,
      });
    }
  }
}

function isRetryable(error: F1ApiError): boolean {
  if (error.kind === 'network') return true;
  return (
    error.kind === 'http_error' &&
    error.status !== undefined &&
    RETRYABLE_STATUSES.has(error.status)
  );
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

function toTransportError(
  error: unknown,
  path: string,
  timeoutMs: number,
): F1ApiError {
  if (isTimeout(error)) {
    return new F1ApiError(
      'timeout',
      path,
      `No answer from ${path} within ${timeoutMs} ms`,
      { cause: error },
    );
  }
  return new F1ApiError('network', path, `Request to ${path} failed`, {
    cause: error,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
