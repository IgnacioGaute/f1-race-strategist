import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { type ApiErrorCode, apiException } from '../common/api-error';
import type { SimulationRequestDto } from '../simulation/dto/simulation-request.dto';
import { SimulationService } from '../simulation/simulation.service';
import type {
  SimulationResult,
  StrategyStint,
} from '../simulation/simulation.types';
import { SavedSimulation } from './saved-simulation.entity';

const HISTORY_LIMIT = 50;

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

@Injectable()
export class SavedSimulationsService {
  private readonly logger = new Logger(SavedSimulationsService.name);

  constructor(
    private readonly simulationService: SimulationService,
    @InjectRepository(SavedSimulation)
    private readonly repository: Repository<SavedSimulation>,
  ) {}

  /** Recomputes the result server-side and stores strategy + result together. */
  async save(request: SimulationRequestDto): Promise<SavedSimulationDetail> {
    const simulation = await this.simulationService.simulate(request);
    const entity = this.repository.create({
      raceId: simulation.raceId,
      raceName: simulation.raceName,
      modelVersion: simulation.result.modelVersion,
      totalTimeSeconds: simulation.result.totalTimeSeconds,
      pitStopCount: simulation.result.pitStopCount,
      strategy: simulation.strategy,
      result: simulation.result,
    });

    let saved: SavedSimulation;
    try {
      saved = await this.repository.save(entity);
    } catch (error) {
      throw this.persistenceError(
        `saving a simulation for race ${simulation.raceId}`,
        'SAVE_FAILED',
        'No se pudo guardar la simulación: el resultado no quedó almacenado.',
        error,
      );
    }
    this.logger.log(`Saved simulation ${saved.id} for race ${saved.raceId}`);
    return toDetail(saved);
  }

  async list(): Promise<SavedSimulationSummary[]> {
    let rows: SavedSimulation[];
    try {
      rows = await this.repository.find({
        select: {
          id: true,
          createdAt: true,
          raceId: true,
          raceName: true,
          modelVersion: true,
          totalTimeSeconds: true,
          pitStopCount: true,
          strategy: true,
        },
        order: { createdAt: 'DESC' },
        take: HISTORY_LIMIT,
      });
    } catch (error) {
      throw this.persistenceError(
        'listing saved simulations',
        'HISTORY_UNAVAILABLE',
        'No se pudo consultar el historial de simulaciones.',
        error,
      );
    }
    return rows.map(toSummary);
  }

  async get(id: string): Promise<SavedSimulationDetail> {
    let row: SavedSimulation | null;
    try {
      row = await this.repository.findOneBy({ id });
    } catch (error) {
      throw this.persistenceError(
        `loading saved simulation ${id}`,
        'SAVED_SIMULATION_UNAVAILABLE',
        'No se pudo consultar la simulación guardada.',
        error,
      );
    }
    if (!row) {
      throw apiException(
        HttpStatus.NOT_FOUND,
        'SAVED_SIMULATION_NOT_FOUND',
        'No existe una simulación guardada con ese id.',
      );
    }
    return toDetail(row);
  }

  private persistenceError(
    operation: string,
    code: ApiErrorCode,
    userMessage: string,
    error: unknown,
  ): HttpException {
    this.logger.error(
      `Database error while ${operation}`,
      error instanceof Error ? error.stack : String(error),
    );
    return apiException(HttpStatus.SERVICE_UNAVAILABLE, code, userMessage, {
      cause: error,
    });
  }
}

function toSummary(row: SavedSimulation): SavedSimulationSummary {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    raceId: row.raceId,
    raceName: row.raceName,
    modelVersion: row.modelVersion,
    totalTimeSeconds: row.totalTimeSeconds,
    pitStopCount: row.pitStopCount,
    strategy: row.strategy,
  };
}

function toDetail(row: SavedSimulation): SavedSimulationDetail {
  return { ...toSummary(row), result: row.result };
}
