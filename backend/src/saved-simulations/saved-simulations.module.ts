import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimulationModule } from '../simulation/simulation.module';
import { SavedSimulation } from './saved-simulation.entity';
import { SavedSimulationsController } from './saved-simulations.controller';
import { SavedSimulationsService } from './saved-simulations.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedSimulation]), SimulationModule],
  controllers: [SavedSimulationsController],
  providers: [SavedSimulationsService],
})
export class SavedSimulationsModule {}
