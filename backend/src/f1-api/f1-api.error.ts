export type F1ApiErrorKind =
  /** The provider did not answer within the configured timeout. */
  | 'timeout'
  /** The request never got an HTTP response (DNS, connection reset...). */
  | 'network'
  /** The provider answered 404 for the requested resource. */
  | 'not_found'
  /** Any other non-2xx answer. */
  | 'http_error'
  /** 2xx answer whose body does not match the documented contract. */
  | 'invalid_response';

export class F1ApiError extends Error {
  /** HTTP status returned by the provider, when there was one. */
  readonly status: number | undefined;

  constructor(
    readonly kind: F1ApiErrorKind,
    readonly path: string,
    message: string,
    options?: { cause?: unknown; status?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'F1ApiError';
    this.status = options?.status;
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
