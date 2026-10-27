import { Logger } from '@nestjs/common';
import { F1ApiClient } from './f1-api.client';
import { F1ApiError } from './f1-api.error';

const config = { baseUrl: 'https://f1.test', timeoutMs: 30_000 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('F1ApiClient', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('unwraps and validates a list response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        statusCode: 200,
        data: {
          teams: [{ id: 'team-01', name: 'McLaren', carPerformance: 0.99 }],
        },
      }),
    );

    await expect(new F1ApiClient(config).getTeams()).resolves.toEqual([
      { id: 'team-01', name: 'McLaren', carPerformance: 0.99 },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://f1.test/api/teams',
      expect.objectContaining({
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    );
  });

  it('treats a body without data as an invalid response, not an empty list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ statusCode: 200 }));

    await expect(new F1ApiClient(config).getRaces()).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('rejects payloads with wrong field types', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { races: [{ id: 'race-01', laps: '57' }] } }),
    );

    await expect(new F1ApiClient(config).getRaces()).rejects.toBeInstanceOf(
      F1ApiError,
    );
  });

  it('maps a 404 to not_found without retrying', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'RACE4040' }, 404));

    await expect(
      new F1ApiClient(config).getRace('race-99'),
    ).rejects.toMatchObject({
      kind: 'not_found',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 503 once and then gives up', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({}, 503)));

    await expect(new F1ApiClient(config).getTyres()).rejects.toMatchObject({
      kind: 'http_error',
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 500', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({}, 500)));

    await expect(new F1ApiClient(config).getTyres()).rejects.toMatchObject({
      kind: 'http_error',
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports timeouts as timeout errors and does not retry them', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );

    await expect(new F1ApiClient(config).getTeams()).rejects.toMatchObject({
      kind: 'timeout',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe('total time budget', () => {
    const budgetConfig = { baseUrl: 'https://f1.test', timeoutMs: 20_000 };
    let timeoutSpy: jest.SpiedFunction<typeof AbortSignal.timeout>;

    beforeEach(() => {
      jest.useFakeTimers({ now: 0 });
      timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    });

    afterEach(() => jest.useRealTimers());

    /** Moves the (fake) clock forward, as a slow provider would, then answers. */
    function answerAfter(elapsedMs: number, response: Response) {
      return () => {
        jest.setSystemTime(Date.now() + elapsedMs);
        return Promise.resolve(response);
      };
    }

    const attemptTimeouts = () => timeoutSpy.mock.calls.map(([ms]) => ms);

    it('gives the retry only what is left of the budget', async () => {
      fetchMock
        .mockImplementationOnce(answerAfter(6_000, jsonResponse({}, 503)))
        .mockResolvedValueOnce(jsonResponse({ data: { teams: [] } }));

      const teams = new F1ApiClient(budgetConfig).getTeams();
      await jest.advanceTimersByTimeAsync(1_000);

      await expect(teams).resolves.toEqual([]);
      // 20 s budget - 6 s first attempt - 1 s wait = 13 s for the retry.
      expect(attemptTimeouts()).toEqual([20_000, 13_000]);
      expect(Date.now()).toBeLessThanOrEqual(budgetConfig.timeoutMs);
    });

    it('still retries a network error within the budget', async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(jsonResponse({ data: { teams: [] } }));

      const teams = new F1ApiClient(budgetConfig).getTeams();
      await jest.advanceTimersByTimeAsync(1_000);

      await expect(teams).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not start a retry when the budget left is too short', async () => {
      fetchMock.mockImplementation(answerAfter(16_000, jsonResponse({}, 503)));

      await expect(
        new F1ApiClient(budgetConfig).getTeams(),
      ).rejects.toMatchObject({ kind: 'http_error', status: 503 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(attemptTimeouts()).toEqual([20_000]);
    });
  });

  it('caches successful answers and does not cache failures', async () => {
    const client = new F1ApiClient(config);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ data: { teams: [] } }));

    await expect(client.getTeams()).rejects.toBeInstanceOf(F1ApiError);
    await expect(client.getTeams()).resolves.toEqual([]);
    await expect(client.getTeams()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
