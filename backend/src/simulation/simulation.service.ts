import { HttpStatus, Injectable } from '@nestjs/common';
import { apiException } from '../common/api-error';
import { RacesService } from '../races/races.service';
import type { RaceContext } from '../races/races.types';
import type { SimulationRequestDto } from './dto/simulation-request.dto';
import { type SimulationInput, simulateRace } from './simulation.engine';
import type { SimulationResult, StrategyStint } from './simulation.types';
import { validateStrategy } from './strategy-validation';

export interface SimulationResponse {
  raceId: string;
  raceName: string;
  circuitName: string;
  strategy: StrategyStint[];
  result: SimulationResult;
}

@Injectable()
export class SimulationService {
  constructor(private readonly racesService: RacesService) {}

  /**
   * Loads fresh race data, validates the strategy against it and runs the model.
   * Used both for "simulate" and for "save", so stored results are always computed
   * here and never taken from the browser.
   */
  async simulate(request: SimulationRequestDto): Promise<SimulationResponse> {
    const context = await this.racesService.getRaceContext(request.raceId);
    const strategy: StrategyStint[] = request.stints.map((stint) => ({
      compound: stint.compound,
      laps: stint.laps,
    }));

    const problems = validateStrategy(strategy, {
      totalLaps: context.race.laps,
      availableCompounds: context.tyres.map((tyre) => tyre.compound),
    });
    if (problems.length > 0) {
      throw apiException(
        HttpStatus.BAD_REQUEST,
        'INVALID_STRATEGY',
        'La estrategia no es válida.',
        { problems },
      );
    }

    return {
      raceId: context.race.id,
      raceName: context.race.name,
      circuitName: context.race.circuit.name,
      strategy,
      result: simulateRace(buildSimulationInput(context), strategy),
    };
  }
}

export function buildSimulationInput(context: RaceContext): SimulationInput {
  const { race, simulationParameters: params } = context;
  return {
    totalLaps: race.laps,
    baseLapTimeSeconds: race.circuit.baseLapTime,
    circuitTyreWearMultiplier: race.circuit.tyreWear,
    // The race-level parameters are preferred over the circuit defaults.
    pitStopLossSeconds: params.pitStopLoss,
    tyreChangeTimeSeconds: params.tyreChangeTime,
    fuelEffectPerLapSeconds: params.fuelEffectPerLap,
    minimumPitStops: params.minimumPitStops,
    tyres: context.tyres,
    weather: context.weather.forecast,
  };
}
