import { type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { ApiErrorBody } from '../src/common/api-error';
import { F1ApiClient } from '../src/f1-api/f1-api.client';
import { F1ApiError } from '../src/f1-api/f1-api.error';
import { configureHttpPipeline } from '../src/http-pipeline';
import { RacesController } from '../src/races/races.controller';
import { RacesService } from '../src/races/races.service';
import { SavedSimulation } from '../src/saved-simulations/saved-simulation.entity';
import { SavedSimulationsController } from '../src/saved-simulations/saved-simulations.controller';
import { SavedSimulationsService } from '../src/saved-simulations/saved-simulations.service';
import { SimulationController } from '../src/simulation/simulation.controller';
import { SimulationService } from '../src/simulation/simulation.service';
import {
  fixtureF1ApiClient,
  type F1ApiClientLike,
} from '../src/testing/f1-fixtures';

/**
 * HTTP contract with the external API and the database replaced by test doubles.
 * Checks status codes and error translation, not the simulation numbers.
 */
describe('HTTP API (fixtures, no network, no database)', () => {
  let app: INestApplication<App>;
  const repository = {
    create: (row: Partial<SavedSimulation>) => row,
    save: jest.fn(),
  };

  async function startApp(client: F1ApiClientLike): Promise<void> {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        RacesController,
        SimulationController,
        SavedSimulationsController,
      ],
      providers: [
        RacesService,
        SimulationService,
        SavedSimulationsService,
        { provide: F1ApiClient, useValue: client },
        { provide: getRepositoryToken(SavedSimulation), useValue: repository },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureHttpPipeline(app);
    await app.init();
  }

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    repository.save.mockReset();
    await app.close();
  });

  const validStrategy = {
    raceId: 'race-test',
    stints: [
      { compound: 'SOFT', laps: 4 },
      { compound: 'HARD', laps: 6 },
    ],
  };

  it('POST /simulations returns the breakdown for a valid strategy', async () => {
    await startApp(fixtureF1ApiClient());

    const response = await request(app.getHttpServer())
      .post('/simulations')
      .send(validStrategy)
      .expect(200);

    const body = response.body as { result: { pitStopCount: number } };
    expect(body.result.pitStopCount).toBe(1);
  });

  it('POST /simulations rejects malformed and inconsistent strategies with coded 400s', async () => {
    await startApp(fixtureF1ApiClient());
    const server = app.getHttpServer();
    const reject = async (payload: object) => {
      const response = await request(server)
        .post('/simulations')
        .send(payload)
        .expect(400);
      return errorBody(response.body);
    };

    // Shape errors (DTO): one readable problem per field, with the stint number.
    expect(await reject({ raceId: 'race-test', stints: [] })).toMatchObject({
      code: 'INVALID_REQUEST',
      problems: [{ code: 'STRATEGY_EMPTY' }],
    });
    expect(
      await reject({
        raceId: 'race-test',
        stints: [{ compound: 'SOFT', laps: 2.5 }],
      }),
    ).toMatchObject({
      code: 'INVALID_REQUEST',
      problems: [{ code: 'LAPS_NOT_INTEGER', params: { stint: 1 } }],
    });
    expect(
      await reject({
        raceId: 'race-test',
        stints: [{ compound: 'SOFT', laps: 10 }],
        totalTimeSeconds: 1,
      }),
    ).toMatchObject({
      problems: [
        { code: 'UNKNOWN_FIELD', params: { field: 'totalTimeSeconds' } },
      ],
    });

    // Business rules that need race data.
    expect(
      await reject({
        raceId: 'race-test',
        stints: [{ compound: 'SOFT', laps: 9 }],
      }),
    ).toMatchObject({
      code: 'INVALID_STRATEGY',
      problems: [{ code: 'LAPS_MISMATCH', params: { assigned: 9, total: 10 } }],
    });
    expect(
      await reject({
        raceId: 'race-test',
        stints: [{ compound: 'ULTRA', laps: 10 }],
      }),
    ).toMatchObject({
      code: 'INVALID_STRATEGY',
      problems: [{ code: 'COMPOUND_UNAVAILABLE' }],
    });
  });

  it('maps provider failures to 502/504 instead of an empty or successful answer', async () => {
    await startApp(
      fixtureF1ApiClient({
        getRaces: () =>
          Promise.reject(new F1ApiError('http_error', '/api/races', '500')),
        getRace: () =>
          Promise.reject(new F1ApiError('timeout', '/api/races/x', 'timeout')),
      }),
    );
    const server = app.getHttpServer();

    const races = await request(server).get('/races').expect(502);
    expect(errorBody(races.body).code).toBe('PROVIDER_UNAVAILABLE');
    const simulation = await request(server)
      .post('/simulations')
      .send(validStrategy)
      .expect(504);
    expect(errorBody(simulation.body).code).toBe('PROVIDER_TIMEOUT');
  });

  it('returns 404 for an unknown race', async () => {
    await startApp(
      fixtureF1ApiClient({
        getRace: () =>
          Promise.reject(new F1ApiError('not_found', '/api/races/x', 'nf')),
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/races/race-99/context')
      .expect(404);
    expect(errorBody(response.body)).toMatchObject({
      code: 'RACE_NOT_FOUND',
      params: { raceId: 'race-99' },
    });
  });

  it('POST /saved-simulations answers 503 when the database write fails', async () => {
    await startApp(fixtureF1ApiClient());
    repository.save.mockRejectedValueOnce(new Error('connection refused'));

    const response = await request(app.getHttpServer())
      .post('/saved-simulations')
      .send(validStrategy)
      .expect(503);

    expect(response.body).not.toHaveProperty('id');
    expect(errorBody(response.body).code).toBe('SAVE_FAILED');
  });
});

/** supertest types bodies as `any`; this narrows them for the assertions above. */
function errorBody(body: unknown): Partial<ApiErrorBody> {
  return typeof body === 'object' && body !== null ? body : {};
}
