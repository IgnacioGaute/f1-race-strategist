// Contract of our NestJS backend (mirrors backend/src/**/*.types.ts).

export interface RaceSummary {
  id: string;
  name: string;
  round: number;
  date: string;
  laps: number;
  circuitName: string;
  country: string;
  rainProbability: number;
}

export interface Circuit {
  id: string;
  name: string;
  country: string;
  type: string;
  laps: number;
  lengthKm: number;
  baseLapTime: number;
  pitStopLoss: number;
  tyreWear: number;
  overtakingDifficulty: number;
}

export interface RaceDetails extends Omit<RaceSummary, "circuitName" | "country"> {
  circuitId: string;
  temperature: number;
  circuit: Circuit;
}

export interface Tyre {
  compound: string;
  pace: number;
  degradation: number;
  wetPerformance: number;
  optimalRainIntensity: { min: number; max: number };
}

export interface WeatherSegment {
  fromLap: number;
  toLap: number;
  temperature: number;
  rainIntensity: number;
}

export interface WeatherForecast {
  raceId: string;
  summary: string;
  forecast: WeatherSegment[];
}

export interface SimulationParameters {
  raceId: string;
  lapTimeVariance: number;
  pitStopLoss: number;
  tyreChangeTime: number;
  fuelEffectPerLap: number;
  safetyCarProbability: number;
  minimumPitStops: number;
}

export interface Team {
  id: string;
  name: string;
  carPerformance: number;
}

export interface Driver {
  id: string;
  name: string;
  number: number;
  teamId: string;
  pace: number;
  consistency: number;
}

export interface RaceContext {
  race: RaceDetails;
  weather: WeatherForecast;
  simulationParameters: SimulationParameters;
  tyres: Tyre[];
  grid: { team: Team; drivers: Driver[] }[];
}

export interface StrategyStint {
  compound: string;
  laps: number;
}

export interface LapTimeComponents {
  base: number;
  compound: number;
  tyreWear: number;
  fuel: number;
  rain: number;
}

export interface SimulatedLap {
  lap: number;
  stintNumber: number;
  compound: string;
  tyreAge: number;
  rainIntensity: number;
  lapTimeSeconds: number;
  components: LapTimeComponents;
}

export interface SimulatedStint {
  stintNumber: number;
  compound: string;
  startLap: number;
  endLap: number;
  laps: number;
  timeSeconds: number;
  averageLapTimeSeconds: number;
  tyreWearSeconds: number;
  rainPenaltySeconds: number;
}

export interface SimulatedPitStop {
  stopNumber: number;
  inLap: number;
  fromCompound: string;
  toCompound: string;
  pitLaneLossSeconds: number;
  tyreChangeSeconds: number;
  totalLossSeconds: number;
}

export interface SimulationResult {
  modelVersion: string;
  totalTimeSeconds: number;
  lapTimeTotalSeconds: number;
  pitStopTotalSeconds: number;
  pitStopCount: number;
  meetsMinimumPitStops: boolean;
  timeBreakdown: LapTimeComponents & { pitStops: number };
  stints: SimulatedStint[];
  pitStops: SimulatedPitStop[];
  laps: SimulatedLap[];
  parametersUsed: {
    totalLaps: number;
    baseLapTimeSeconds: number;
    circuitTyreWearMultiplier: number;
    pitStopLossSeconds: number;
    tyreChangeTimeSeconds: number;
    fuelEffectPerLapSeconds: number;
    rainPenaltySecondsPerIntensity: number;
    minimumPitStops: number;
  };
  assumptions: string[];
}

export interface SimulationResponse {
  raceId: string;
  raceName: string;
  circuitName: string;
  strategy: StrategyStint[];
  result: SimulationResult;
}

export interface SavedSimulationSummary {
  id: string;
  createdAt: string;
  raceId: string;
  raceName: string;
  modelVersion: string;
  totalTimeSeconds: number;
  pitStopCount: number;
  strategy: StrategyStint[];
}

export interface SavedSimulationDetail extends SavedSimulationSummary {
  result: SimulationResult;
}

/**
 * Generic async state used by every section of the screen. Errors are kept as
 * received and translated when rendered, so they follow the selected language.
 */
export type LoadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: T };
