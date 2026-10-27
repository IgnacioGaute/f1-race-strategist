import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { apiException } from '../common/api-error';
import { SimulationRequestDto } from '../simulation/dto/simulation-request.dto';
import {
  type SavedSimulationDetail,
  type SavedSimulationSummary,
  SavedSimulationsService,
} from './saved-simulations.service';

@Controller('saved-simulations')
export class SavedSimulationsController {
  constructor(private readonly savedSimulations: SavedSimulationsService) {}

  /** Accepts only the strategy; the stored result is recomputed by the backend. */
  @Post()
  save(@Body() request: SimulationRequestDto): Promise<SavedSimulationDetail> {
    return this.savedSimulations.save(request);
  }

  @Get()
  list(): Promise<SavedSimulationSummary[]> {
    return this.savedSimulations.list();
  }

  @Get(':id')
  get(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          apiException(
            HttpStatus.BAD_REQUEST,
            'INVALID_SAVED_SIMULATION_ID',
            'El identificador de la simulación guardada no es válido.',
          ),
      }),
    )
    id: string,
  ): Promise<SavedSimulationDetail> {
    return this.savedSimulations.get(id);
  }
}
