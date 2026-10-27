import { Controller, Get, Param } from '@nestjs/common';
import { RaceIdPipe } from './race-id.pipe';
import { RacesService } from './races.service';
import type { RaceContext, RaceSummary } from './races.types';

@Controller('races')
export class RacesController {
  constructor(private readonly racesService: RacesService) {}

  @Get()
  listRaces(): Promise<RaceSummary[]> {
    return this.racesService.listRaces();
  }

  @Get(':raceId/context')
  getRaceContext(
    @Param('raceId', RaceIdPipe) raceId: string,
  ): Promise<RaceContext> {
    return this.racesService.getRaceContext(raceId);
  }
}
