// Shapes of the external F1 API (Swagger 2.0 spec at /docs.json).
// Units come from the spec descriptions; every numeric value is fictional.

export interface Circuit {
  id: string;
  name: string;
  country: string;
  type: string;
  laps: number;
  lengthKm: number;
  /** Reference dry lap time, seconds. */
  baseLapTime: number;
  /** Seconds lost for a pit stop, excluding the tyre change. */
  pitStopLoss: number;
  /** Multiplier applied to tyre degradation. 1.0 is neutral. */
  tyreWear: number;
  /** 0 = easy to overtake, 1 = nearly impossible. */
  overtakingDifficulty: number;
}

export interface Race {
  id: string;
  name: string;
  round: number;
  date: string;
  circuitId: string;
  laps: number;
  /** Expected ambient temperature, °C. */
  temperature: number;
  /** 0 = dry certainty, 1 = rain certainty. */
  rainProbability: number;
}

export interface RaceDetails extends Race {
  circuit: Circuit;
}

export interface Team {
  id: string;
  name: string;
  /** Relative car performance. Higher is faster. Unitless. */
  carPerformance: number;
}

export interface Driver {
  id: string;
  name: string;
  number: number;
  teamId: string;
  /** Relative driver pace. Higher is faster. Unitless. */
  pace: number;
  consistency: number;
}

export interface RainIntensityRange {
  min: number;
  max: number;
}

export interface Tyre {
  /** Spec enum: SOFT, MEDIUM, HARD, INTERMEDIATE, WET. */
  compound: string;
  /** Lap time delta in seconds vs the circuit base lap time. Negative is faster. */
  pace: number;
  /** Seconds added per lap of stint age. */
  degradation: number;
  /** Grip on a wet track. 0 = unusable, 1 = fully effective. */
  wetPerformance: number;
  /** Rain intensity band this compound is designed for. */
  optimalRainIntensity: RainIntensityRange;
}

export interface WeatherSegment {
  fromLap: number;
  toLap: number;
  temperature: number;
  /** 0 = dry, 1 = heaviest rain. */
  rainIntensity: number;
}

export interface WeatherForecast {
  raceId: string;
  summary: string;
  forecast: WeatherSegment[];
}

export interface SimulationParameters {
  raceId: string;
  /** Typical lap-to-lap noise, seconds. */
  lapTimeVariance: number;
  /** Seconds lost for a pit stop, excluding the tyre change. */
  pitStopLoss: number;
  /** Stationary seconds to swap tyres. */
  tyreChangeTime: number;
  /** Seconds per lap gained as fuel burns off. */
  fuelEffectPerLap: number;
  safetyCarProbability: number;
  /** Pit stops required by the sporting rules. */
  minimumPitStops: number;
}
