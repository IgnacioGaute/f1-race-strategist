export interface StrategyStint {
  compound: string;
  laps: number;
}

/** Seconds contributed by each term of the lap-time formula. */
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
  /** Laps already completed on this set before this lap (0 on a fresh set). */
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
  /** The stop is charged at the end of this lap (last lap of the outgoing stint). */
  inLap: number;
  fromCompound: string;
  toCompound: string;
  pitLaneLossSeconds: number;
  tyreChangeSeconds: number;
  totalLossSeconds: number;
}

export interface SimulationParametersUsed {
  totalLaps: number;
  baseLapTimeSeconds: number;
  circuitTyreWearMultiplier: number;
  pitStopLossSeconds: number;
  tyreChangeTimeSeconds: number;
  fuelEffectPerLapSeconds: number;
  rainPenaltySecondsPerIntensity: number;
  minimumPitStops: number;
}

export interface SimulationResult {
  modelVersion: string;
  totalTimeSeconds: number;
  lapTimeTotalSeconds: number;
  pitStopTotalSeconds: number;
  pitStopCount: number;
  meetsMinimumPitStops: boolean;
  /** Sum of each formula term over the whole race, plus pit stops. */
  timeBreakdown: LapTimeComponents & { pitStops: number };
  stints: SimulatedStint[];
  pitStops: SimulatedPitStop[];
  laps: SimulatedLap[];
  parametersUsed: SimulationParametersUsed;
  assumptions: string[];
}
