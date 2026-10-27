import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SimulationRequestDto } from './dto/simulation-request.dto';
import {
  type SimulationResponse,
  SimulationService,
} from './simulation.service';

@Controller('simulations')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  /** Computes a result without storing it. */
  @Post()
  @HttpCode(HttpStatus.OK)
  simulate(@Body() request: SimulationRequestDto): Promise<SimulationResponse> {
    return this.simulationService.simulate(request);
  }
}
