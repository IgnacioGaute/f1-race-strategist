import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { F1ApiClient } from '../f1-api/f1-api.client';
import { RacesService } from '../races/races.service';
import { SimulationService } from '../simulation/simulation.service';
import { fixtureF1ApiClient } from '../testing/f1-fixtures';
import { SavedSimulation } from './saved-simulation.entity';
import { SavedSimulationsService } from './saved-simulations.service';

const request = {
  raceId: 'race-test',
  stints: [
    { compound: 'SOFT', laps: 5 },
    { compound: 'WET', laps: 5 },
  ],
};

async function serviceWith(repository: {
  create: (row: Partial<SavedSimulation>) => Partial<SavedSimulation>;
  save: jest.Mock;
}): Promise<SavedSimulationsService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SavedSimulationsService,
      SimulationService,
      RacesService,
      { provide: F1ApiClient, useValue: fixtureF1ApiClient() },
      { provide: getRepositoryToken(SavedSimulation), useValue: repository },
    ],
  }).compile();
  return moduleRef.get(SavedSimulationsService);
}

describe('SavedSimulationsService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('stores the result computed by the backend', async () => {
    const save = jest.fn((row: Partial<SavedSimulation>) =>
      Promise.resolve({ ...row, id: 'id-1', createdAt: new Date(0) }),
    );
    const service = await serviceWith({ create: (row) => row, save });

    const saved = await service.save(request);

    expect(saved.id).toBe('id-1');
    expect(saved.pitStopCount).toBe(1);
    expect(saved.result.stints.map((s) => s.compound)).toEqual(['SOFT', 'WET']);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reports a database failure instead of claiming the simulation was saved', async () => {
    const save = jest.fn(() => Promise.reject(new Error('connection refused')));
    const service = await serviceWith({ create: (row) => row, save });

    await expect(service.save(request)).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: 'SAVE_FAILED' }) as unknown,
    });
  });
});
