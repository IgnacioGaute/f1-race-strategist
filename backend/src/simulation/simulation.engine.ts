import type { Tyre, WeatherSegment } from '../f1-api/f1-api.types';
import type {
  LapTimeComponents,
  SimulatedLap,
  SimulatedPitStop,
  SimulatedStint,
  SimulationParametersUsed,
  SimulationResult,
  StrategyStint,
} from './simulation.types';

export const SIMULATION_MODEL_VERSION = 'lap-by-lap-v1';

/**
 * Our own constant (not provided by the API): seconds added per lap for each unit
 * of rain intensity above the compound's optimal band, scaled by its lack of wet
 * grip. Chosen so that, with the provider's tyre data, the compound designed for
 * the current rain is roughly the fastest one.
 */
export const RAIN_PENALTY_SECONDS_PER_INTENSITY = 30;

export interface SimulationInput {
  totalLaps: number;
  baseLapTimeSeconds: number;
  circuitTyreWearMultiplier: number;
  pitStopLossSeconds: number;
  tyreChangeTimeSeconds: number;
  fuelEffectPerLapSeconds: number;
  minimumPitStops: number;
  tyres: readonly Tyre[];
  weather: readonly WeatherSegment[];
}

export const SIMULATION_ASSUMPTIONS: readonly string[] = [
  'Tiempo de vuelta = tiempo base del circuito + ritmo del compuesto + desgaste + penalización por lluvia − efecto del combustible. Todo en segundos.',
  'Desgaste = degradación del compuesto × multiplicador de desgaste del circuito × edad del neumático. La edad es 0 en la primera vuelta de cada juego nuevo y suma 1 por vuelta.',
  'Combustible: el efecto del combustible resta fuelEffectPerLap × (n − 1) segundos en la vuelta n. Se acumula durante toda la carrera y no se reinicia en las paradas. Que una vuelta sea más rápida o más lenta depende también del desgaste y de la penalización por lluvia.',
  `Lluvia: si la intensidad de la vuelta supera el máximo óptimo del compuesto, se suman ${RAIN_PENALTY_SECONDS_PER_INTENSITY} s × exceso × (1 − rendimiento en mojado). Esta constante es propia del modelo, no viene de la API. Es una simplificación: solo se penaliza superar el máximo óptimo; no hay penalización adicional por estar debajo del mínimo óptimo, y el ritmo propio del compuesto se contabiliza por separado.`,
  'Cada parada suma pérdida en boxes + tiempo de cambio de neumáticos y se cuenta al final de la última vuelta del tramo. No hay parada antes de la salida ni después de la última vuelta.',
  'El mínimo de paradas de la API se informa como advertencia; no bloquea la simulación.',
  'Modelo determinista: no simula variación entre vueltas, safety car, tráfico, adelantamientos, temperatura ni rendimiento de pilotos o equipos.',
];

export function simulateRace(
  input: SimulationInput,
  strategy: readonly StrategyStint[],
): SimulationResult {
  const tyresByCompound = new Map(input.tyres.map((t) => [t.compound, t]));
  const totals: LapTimeComponents = {
    base: 0,
    compound: 0,
    tyreWear: 0,
    fuel: 0,
    rain: 0,
  };
  const laps: SimulatedLap[] = [];
  const stints: SimulatedStint[] = [];
  const pitStops: SimulatedPitStop[] = [];
  let lap = 1;

  strategy.forEach((stint, index) => {
    const tyre = tyresByCompound.get(stint.compound);
    if (!tyre) {
      // Strategies are validated before reaching the engine.
      throw new Error(`Unknown compound ${stint.compound}`);
    }
    const stintNumber = index + 1;
    const startLap = lap;
    let stintTime = 0;
    let stintWear = 0;
    let stintRain = 0;

    for (let tyreAge = 0; tyreAge < stint.laps; tyreAge++, lap++) {
      const rainIntensity = rainIntensityForLap(input.weather, lap);
      const components: LapTimeComponents = {
        base: input.baseLapTimeSeconds,
        compound: tyre.pace,
        tyreWear: tyre.degradation * input.circuitTyreWearMultiplier * tyreAge,
        fuel: -input.fuelEffectPerLapSeconds * (lap - 1),
        rain: rainPenalty(tyre, rainIntensity),
      };
      const lapTimeSeconds =
        components.base +
        components.compound +
        components.tyreWear +
        components.fuel +
        components.rain;

      totals.base += components.base;
      totals.compound += components.compound;
      totals.tyreWear += components.tyreWear;
      totals.fuel += components.fuel;
      totals.rain += components.rain;
      stintTime += lapTimeSeconds;
      stintWear += components.tyreWear;
      stintRain += components.rain;

      laps.push({
        lap,
        stintNumber,
        compound: stint.compound,
        tyreAge,
        rainIntensity,
        lapTimeSeconds,
        components,
      });
    }

    const endLap = lap - 1;
    stints.push({
      stintNumber,
      compound: stint.compound,
      startLap,
      endLap,
      laps: stint.laps,
      timeSeconds: stintTime,
      averageLapTimeSeconds: stintTime / stint.laps,
      tyreWearSeconds: stintWear,
      rainPenaltySeconds: stintRain,
    });

    const nextStint = strategy[index + 1];
    if (nextStint) {
      pitStops.push({
        stopNumber: pitStops.length + 1,
        inLap: endLap,
        fromCompound: stint.compound,
        toCompound: nextStint.compound,
        pitLaneLossSeconds: input.pitStopLossSeconds,
        tyreChangeSeconds: input.tyreChangeTimeSeconds,
        totalLossSeconds:
          input.pitStopLossSeconds + input.tyreChangeTimeSeconds,
      });
    }
  });

  if (lap - 1 !== input.totalLaps) {
    throw new Error(
      `Strategy covers ${lap - 1} laps but the race has ${input.totalLaps}`,
    );
  }

  const lapTimeTotalSeconds = laps.reduce(
    (sum, l) => sum + l.lapTimeSeconds,
    0,
  );
  const pitStopTotalSeconds = pitStops.reduce(
    (sum, stop) => sum + stop.totalLossSeconds,
    0,
  );

  return {
    modelVersion: SIMULATION_MODEL_VERSION,
    totalTimeSeconds: lapTimeTotalSeconds + pitStopTotalSeconds,
    lapTimeTotalSeconds,
    pitStopTotalSeconds,
    pitStopCount: pitStops.length,
    meetsMinimumPitStops: pitStops.length >= input.minimumPitStops,
    timeBreakdown: { ...totals, pitStops: pitStopTotalSeconds },
    stints,
    pitStops,
    laps,
    parametersUsed: parametersUsed(input),
    assumptions: [...SIMULATION_ASSUMPTIONS],
  };
}

export function rainPenalty(tyre: Tyre, rainIntensity: number): number {
  const excess = Math.max(0, rainIntensity - tyre.optimalRainIntensity.max);
  return (
    RAIN_PENALTY_SECONDS_PER_INTENSITY * excess * (1 - tyre.wetPerformance)
  );
}

function rainIntensityForLap(
  weather: readonly WeatherSegment[],
  lap: number,
): number {
  const segment = weather.find((s) => s.fromLap <= lap && lap <= s.toLap);
  if (!segment) {
    // Coverage is checked when the race context is loaded.
    throw new Error(`No weather forecast for lap ${lap}`);
  }
  return segment.rainIntensity;
}

function parametersUsed(input: SimulationInput): SimulationParametersUsed {
  return {
    totalLaps: input.totalLaps,
    baseLapTimeSeconds: input.baseLapTimeSeconds,
    circuitTyreWearMultiplier: input.circuitTyreWearMultiplier,
    pitStopLossSeconds: input.pitStopLossSeconds,
    tyreChangeTimeSeconds: input.tyreChangeTimeSeconds,
    fuelEffectPerLapSeconds: input.fuelEffectPerLapSeconds,
    rainPenaltySecondsPerIntensity: RAIN_PENALTY_SECONDS_PER_INTENSITY,
    minimumPitStops: input.minimumPitStops,
  };
}
