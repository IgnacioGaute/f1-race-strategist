import type {
  Circuit,
  Driver,
  Race,
  RaceDetails,
  SimulationParameters,
  Team,
  Tyre,
  WeatherForecast,
  WeatherSegment,
} from './f1-api.types';

/**
 * Runtime validation of F1 API payloads. TypeScript types alone do not protect
 * us from a provider that changes or breaks its contract.
 */
export class InvalidShapeError extends Error {
  constructor(path: string, expected: string) {
    super(`${path}: expected ${expected}`);
    this.name = 'InvalidShapeError';
  }
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown, path: string): JsonObject {
  if (!isObject(value)) throw new InvalidShapeError(path, 'an object');
  return value;
}

function readString(obj: JsonObject, key: string, path: string): string {
  const value = obj[key];
  if (typeof value !== 'string')
    throw new InvalidShapeError(`${path}.${key}`, 'a string');
  return value;
}

function readNumber(obj: JsonObject, key: string, path: string): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new InvalidShapeError(`${path}.${key}`, 'a finite number');
  return value;
}

function readInteger(obj: JsonObject, key: string, path: string): number {
  const value = readNumber(obj, key, path);
  if (!Number.isInteger(value))
    throw new InvalidShapeError(`${path}.${key}`, 'an integer');
  return value;
}

function readArray<T>(
  obj: JsonObject,
  key: string,
  path: string,
  parseItem: (item: unknown, itemPath: string) => T,
): T[] {
  const value = obj[key];
  if (!Array.isArray(value))
    throw new InvalidShapeError(`${path}.${key}`, 'an array');
  return value.map((item, index) =>
    parseItem(item, `${path}.${key}[${index}]`),
  );
}

/** Every response is wrapped as `{ statusCode, code, message, data }`. */
export function unwrapData(body: unknown): JsonObject {
  return asObject(asObject(body, 'body').data, 'body.data');
}

export function parseCircuit(value: unknown, path: string): Circuit {
  const obj = asObject(value, path);
  return {
    id: readString(obj, 'id', path),
    name: readString(obj, 'name', path),
    country: readString(obj, 'country', path),
    type: readString(obj, 'type', path),
    laps: readInteger(obj, 'laps', path),
    lengthKm: readNumber(obj, 'lengthKm', path),
    baseLapTime: readNumber(obj, 'baseLapTime', path),
    pitStopLoss: readNumber(obj, 'pitStopLoss', path),
    tyreWear: readNumber(obj, 'tyreWear', path),
    overtakingDifficulty: readNumber(obj, 'overtakingDifficulty', path),
  };
}

export function parseRace(value: unknown, path: string): Race {
  const obj = asObject(value, path);
  return {
    id: readString(obj, 'id', path),
    name: readString(obj, 'name', path),
    round: readInteger(obj, 'round', path),
    date: readString(obj, 'date', path),
    circuitId: readString(obj, 'circuitId', path),
    laps: readInteger(obj, 'laps', path),
    temperature: readNumber(obj, 'temperature', path),
    rainProbability: readNumber(obj, 'rainProbability', path),
  };
}

export function parseRaceDetails(value: unknown, path: string): RaceDetails {
  const obj = asObject(value, path);
  return {
    ...parseRace(obj, path),
    circuit: parseCircuit(obj.circuit, `${path}.circuit`),
  };
}

export function parseTeam(value: unknown, path: string): Team {
  const obj = asObject(value, path);
  return {
    id: readString(obj, 'id', path),
    name: readString(obj, 'name', path),
    carPerformance: readNumber(obj, 'carPerformance', path),
  };
}

export function parseDriver(value: unknown, path: string): Driver {
  const obj = asObject(value, path);
  return {
    id: readString(obj, 'id', path),
    name: readString(obj, 'name', path),
    number: readInteger(obj, 'number', path),
    teamId: readString(obj, 'teamId', path),
    pace: readNumber(obj, 'pace', path),
    consistency: readNumber(obj, 'consistency', path),
  };
}

export function parseTyre(value: unknown, path: string): Tyre {
  const obj = asObject(value, path);
  const rangePath = `${path}.optimalRainIntensity`;
  const range = asObject(obj.optimalRainIntensity, rangePath);
  return {
    compound: readString(obj, 'compound', path),
    pace: readNumber(obj, 'pace', path),
    degradation: readNumber(obj, 'degradation', path),
    wetPerformance: readNumber(obj, 'wetPerformance', path),
    optimalRainIntensity: {
      min: readNumber(range, 'min', rangePath),
      max: readNumber(range, 'max', rangePath),
    },
  };
}

function parseWeatherSegment(value: unknown, path: string): WeatherSegment {
  const obj = asObject(value, path);
  return {
    fromLap: readInteger(obj, 'fromLap', path),
    toLap: readInteger(obj, 'toLap', path),
    temperature: readNumber(obj, 'temperature', path),
    rainIntensity: readNumber(obj, 'rainIntensity', path),
  };
}

export function parseWeatherForecast(
  value: unknown,
  path: string,
): WeatherForecast {
  const obj = asObject(value, path);
  return {
    raceId: readString(obj, 'raceId', path),
    summary: readString(obj, 'summary', path),
    forecast: readArray(obj, 'forecast', path, parseWeatherSegment),
  };
}

export function parseSimulationParameters(
  value: unknown,
  path: string,
): SimulationParameters {
  const obj = asObject(value, path);
  return {
    raceId: readString(obj, 'raceId', path),
    lapTimeVariance: readNumber(obj, 'lapTimeVariance', path),
    pitStopLoss: readNumber(obj, 'pitStopLoss', path),
    tyreChangeTime: readNumber(obj, 'tyreChangeTime', path),
    fuelEffectPerLap: readNumber(obj, 'fuelEffectPerLap', path),
    safetyCarProbability: readNumber(obj, 'safetyCarProbability', path),
    minimumPitStops: readInteger(obj, 'minimumPitStops', path),
  };
}

export function parseList<T>(
  data: JsonObject,
  key: string,
  parseItem: (item: unknown, path: string) => T,
): T[] {
  return readArray(data, key, 'data', parseItem);
}
