/**
 * TEST FIXTURES ONLY — synthetic data with round numbers so expected results can
 * be computed by hand. Never imported by application code.
 */
import type { F1ApiClient } from '../f1-api/f1-api.client';
import type {
  Circuit,
  Driver,
  Race,
  RaceDetails,
  SimulationParameters,
  Team,
  Tyre,
  WeatherForecast,
} from '../f1-api/f1-api.types';
import type { RaceContext } from '../races/races.types';
import type { SimulationInput } from '../simulation/simulation.engine';

export const fixtureCircuit: Circuit = {
  id: 'circuit-test',
  name: 'Fixture Ring',
  country: 'Testland',
  type: 'permanent',
  laps: 10,
  lengthKm: 5,
  baseLapTime: 100,
  pitStopLoss: 20,
  tyreWear: 2,
  overtakingDifficulty: 0.5,
};

export const fixtureRace: Race = {
  id: 'race-test',
  name: 'Fixture Grand Prix',
  round: 1,
  date: '2025-01-01',
  circuitId: fixtureCircuit.id,
  laps: 10,
  temperature: 25,
  rainProbability: 0.5,
};

export const fixtureRaceDetails: RaceDetails = {
  ...fixtureRace,
  circuit: fixtureCircuit,
};

export const fixtureTyres: Tyre[] = [
  {
    compound: 'SOFT',
    pace: -1,
    degradation: 0.1,
    wetPerformance: 0,
    optimalRainIntensity: { min: 0, max: 0.1 },
  },
  {
    compound: 'HARD',
    pace: 0,
    degradation: 0.05,
    wetPerformance: 0.5,
    optimalRainIntensity: { min: 0, max: 0.1 },
  },
  {
    compound: 'WET',
    pace: 3,
    degradation: 0.05,
    wetPerformance: 1,
    optimalRainIntensity: { min: 0.5, max: 1 },
  },
];

/** Dry for laps 1-5, rain intensity 0.6 for laps 6-10. */
export const fixtureWeather: WeatherForecast = {
  raceId: fixtureRace.id,
  summary: 'Dry start, rain later.',
  forecast: [
    { fromLap: 1, toLap: 5, temperature: 25, rainIntensity: 0 },
    { fromLap: 6, toLap: 10, temperature: 20, rainIntensity: 0.6 },
  ],
};

export const fixtureParameters: SimulationParameters = {
  raceId: fixtureRace.id,
  lapTimeVariance: 0.1,
  pitStopLoss: 20,
  tyreChangeTime: 2,
  fuelEffectPerLap: 0.1,
  safetyCarProbability: 0.2,
  minimumPitStops: 1,
};

export const fixtureTeams: Team[] = [
  { id: 'team-a', name: 'Team A', carPerformance: 0.9 },
  { id: 'team-b', name: 'Team B', carPerformance: 0.95 },
];

export const fixtureDrivers: Driver[] = [
  {
    id: 'driver-1',
    name: 'Driver One',
    number: 1,
    teamId: 'team-a',
    pace: 0.9,
    consistency: 0.9,
  },
  {
    id: 'driver-2',
    name: 'Driver Two',
    number: 2,
    teamId: 'team-b',
    pace: 0.95,
    consistency: 0.9,
  },
];

export const fixtureContext: RaceContext = {
  race: fixtureRaceDetails,
  weather: fixtureWeather,
  simulationParameters: fixtureParameters,
  tyres: fixtureTyres,
  grid: [],
};

/** Dry-only input: no rain anywhere, so rain penalties are zero. */
export function dryInput(
  overrides: Partial<SimulationInput> = {},
): SimulationInput {
  return {
    totalLaps: 10,
    baseLapTimeSeconds: 100,
    circuitTyreWearMultiplier: 2,
    pitStopLossSeconds: 20,
    tyreChangeTimeSeconds: 2,
    fuelEffectPerLapSeconds: 0,
    minimumPitStops: 1,
    tyres: fixtureTyres,
    weather: [{ fromLap: 1, toLap: 10, temperature: 25, rainIntensity: 0 }],
    ...overrides,
  };
}

export type F1ApiClientLike = Pick<
  F1ApiClient,
  | 'getRaces'
  | 'getCircuits'
  | 'getTeams'
  | 'getDrivers'
  | 'getTyres'
  | 'getRace'
  | 'getWeather'
  | 'getSimulationParameters'
>;

/** A fake provider answering with the fixtures; override methods to simulate failures. */
export function fixtureF1ApiClient(
  overrides: Partial<F1ApiClientLike> = {},
): F1ApiClientLike {
  return {
    getRaces: () => Promise.resolve([fixtureRace]),
    getCircuits: () => Promise.resolve([fixtureCircuit]),
    getTeams: () => Promise.resolve(fixtureTeams),
    getDrivers: () => Promise.resolve(fixtureDrivers),
    getTyres: () => Promise.resolve(fixtureTyres),
    getRace: () => Promise.resolve(fixtureRaceDetails),
    getWeather: () => Promise.resolve(fixtureWeather),
    getSimulationParameters: () => Promise.resolve(fixtureParameters),
    ...overrides,
  };
}
