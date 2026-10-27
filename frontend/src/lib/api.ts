import type {
  RaceContext,
  RaceSummary,
  SavedSimulationDetail,
  SavedSimulationSummary,
  SimulationResponse,
  StrategyStint,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

/**
 * Longer than the backend's total budget for the F1 provider (F1_API_TIMEOUT_MS:
 * 60 s by default, 80 s at most), so the backend can answer with a meaningful 504
 * before the browser gives up.
 */
const REQUEST_TIMEOUT_MS = 90_000;

/** Failures where no answer from our backend says whether the request was carried out. */
const OUTCOME_UNKNOWN_CODES = new Set(["CLIENT_TIMEOUT", "CLIENT_NETWORK", "CLIENT_EMPTY_RESPONSE"]);

type ErrorParams = Record<string, string | number | string[]>;

export interface ApiProblem {
  code: string;
  message: string;
  params?: ErrorParams;
}

/**
 * Failure of a call to our backend. `code` is a backend error code (see
 * backend/src/common/api-error.ts) or a CLIENT_* code for failures detected here;
 * the UI translates it. `serverMessage` is the backend's default (Spanish) text,
 * used only when a code has no translation.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly options: {
      status?: number;
      params?: ErrorParams;
      problems?: ApiProblem[];
      serverMessage?: string;
    } = {},
  ) {
    super(options.serverMessage ?? code);
    this.name = "ApiError";
  }
}

/**
 * True when a write may have happened despite the error: the connection failed or
 * timed out after sending, or a server error did not come from our error handlers.
 * The browser cannot tell "never arrived" from "arrived but the answer was lost".
 */
export function isOutcomeUnknown(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  if (error.code === "HTTP_STATUS") return (error.options.status ?? 500) >= 500;
  return OUTCOME_UNKNOWN_CODES.has(error.code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readParams(value: unknown): ErrorParams | undefined {
  if (!isRecord(value)) return undefined;
  const params: ErrorParams = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number") params[key] = entry;
    else if (Array.isArray(entry)) params[key] = entry.map(String);
  }
  return params;
}

function readProblems(value: unknown): ApiProblem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((problem) => ({
    code: typeof problem.code === "string" ? problem.code : "INVALID_FIELD",
    message: typeof problem.message === "string" ? problem.message : "",
    params: readParams(problem.params),
  }));
}

function errorFromBody(body: unknown, status: number): ApiError {
  if (isRecord(body) && typeof body.code === "string") {
    return new ApiError(body.code, {
      status,
      params: readParams(body.params),
      problems: readProblems(body.problems),
      serverMessage: typeof body.message === "string" ? body.message : undefined,
    });
  }
  // Errors raised outside our handlers (e.g. a malformed JSON body) carry no code.
  return new ApiError("HTTP_STATUS", { status, params: { status } });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) throw new ApiError("CLIENT_CONFIG");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { accept: "application/json", ...init?.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError("CLIENT_TIMEOUT");
    }
    throw new ApiError("CLIENT_NETWORK", { params: { url: API_BASE_URL } });
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw errorFromBody(body, response.status);
  if (body === null) throw new ApiError("CLIENT_EMPTY_RESPONSE", { status: response.status });
  // Trust boundary: our own backend defines and validates this contract.
  return body as T;
}

function postJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export const api = {
  listRaces: () => request<RaceSummary[]>("/races"),
  getRaceContext: (raceId: string) =>
    request<RaceContext>(`/races/${encodeURIComponent(raceId)}/context`),
  simulate: (raceId: string, stints: StrategyStint[]) =>
    postJson<SimulationResponse>("/simulations", { raceId, stints }),
  saveSimulation: (raceId: string, stints: StrategyStint[]) =>
    postJson<SavedSimulationDetail>("/saved-simulations", { raceId, stints }),
  listSavedSimulations: () =>
    request<SavedSimulationSummary[]>("/saved-simulations"),
  getSavedSimulation: (id: string) =>
    request<SavedSimulationDetail>(`/saved-simulations/${encodeURIComponent(id)}`),
};
