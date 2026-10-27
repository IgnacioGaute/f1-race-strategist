import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable identifiers for every user-facing error. `message` stays in Spanish as
 * the API's default language; clients translate by `code` (and `params`).
 */
export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_STRATEGY'
  | 'INVALID_RACE_ID'
  | 'INVALID_SAVED_SIMULATION_ID'
  | 'RACE_NOT_FOUND'
  | 'SAVED_SIMULATION_NOT_FOUND'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_INVALID_DATA'
  | 'PROVIDER_NOT_FOUND'
  | 'SAVE_FAILED'
  | 'HISTORY_UNAVAILABLE'
  | 'SAVED_SIMULATION_UNAVAILABLE';

/** One concrete problem inside an INVALID_REQUEST / INVALID_STRATEGY error. */
export type ProblemCode =
  | 'STRATEGY_EMPTY'
  | 'TOO_MANY_STINTS'
  | 'STINTS_NOT_A_LIST'
  | 'STINT_INVALID'
  | 'COMPOUND_INVALID'
  | 'COMPOUND_UNAVAILABLE'
  | 'LAPS_NOT_INTEGER'
  | 'LAPS_BELOW_MIN'
  | 'LAPS_ABOVE_MAX'
  | 'LAPS_MISMATCH'
  | 'INVALID_RACE_ID'
  | 'UNKNOWN_FIELD'
  | 'INVALID_FIELD';

export type ProblemParams = Record<string, string | number | string[]>;

export interface ApiProblem {
  code: ProblemCode;
  message: string;
  params?: ProblemParams;
}

export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  params?: ProblemParams;
  problems?: ApiProblem[];
}

export function apiException(
  status: HttpStatus,
  code: ApiErrorCode,
  message: string,
  options: {
    params?: ProblemParams;
    problems?: ApiProblem[];
    cause?: unknown;
  } = {},
): HttpException {
  const body: ApiErrorBody = { statusCode: status, code, message };
  if (options.params) body.params = options.params;
  if (options.problems) body.problems = options.problems;
  return new HttpException(body, status, { cause: options.cause });
}
