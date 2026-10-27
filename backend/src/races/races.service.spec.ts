import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { F1ApiClient } from '../f1-api/f1-api.client';
import { F1ApiError } from '../f1-api/f1-api.error';
import {
  fixtureF1ApiClient,
  fixtureWeather,
  type F1ApiClientLike,
} from '../testing/f1-fixtures';
import { RacesService } from './races.service';

async function serviceWith(client: F1ApiClientLike): Promise<RacesService> {
  const moduleRef = await Test.createTestingModule({
    providers: [RacesService, { provide: F1ApiClient, useValue: client }],
  }).compile();
  return moduleRef.get(RacesService);
}

describe('RacesService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('builds the race context with the grid grouped by team', async () => {
    const service = await serviceWith(fixtureF1ApiClient());
    const context = await service.getRaceContext('race-test');

    expect(context.race.laps).toBe(10);
    expect(context.grid.map((g) => g.team.id)).toEqual(['team-b', 'team-a']);
    expect(context.grid[0].drivers.map((d) => d.id)).toEqual(['driver-2']);
  });

  it('translates an unknown race into a 404', async () => {
    const service = await serviceWith(
      fixtureF1ApiClient({
        getRace: () =>
          Promise.reject(
            new F1ApiError('not_found', '/api/races/x', 'not found'),
          ),
      }),
    );

    await expect(service.getRaceContext('x')).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'RACE_NOT_FOUND' }) as unknown,
    });
  });

  it('propagates provider failures instead of returning partial data', async () => {
    const failure = new F1ApiError('timeout', '/api/tyres', 'timeout');
    const service = await serviceWith(
      fixtureF1ApiClient({ getTyres: () => Promise.reject(failure) }),
    );

    await expect(service.getRaceContext('race-test')).rejects.toBe(failure);
  });

  it('rejects a forecast that leaves laps uncovered', async () => {
    const service = await serviceWith(
      fixtureF1ApiClient({
        getWeather: () =>
          Promise.resolve({
            ...fixtureWeather,
            forecast: [fixtureWeather.forecast[0]],
          }),
      }),
    );

    await expect(service.getRaceContext('race-test')).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('fails the race list when the provider fails, rather than returning []', async () => {
    const service = await serviceWith(
      fixtureF1ApiClient({
        getRaces: () =>
          Promise.reject(new F1ApiError('http_error', '/api/races', '500')),
      }),
    );

    await expect(service.listRaces()).rejects.toBeInstanceOf(F1ApiError);
  });
});
