import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from './config/app-config';
import { buildDataSourceOptions } from './database/database-options';
import { F1ApiModule } from './f1-api/f1-api.module';
import { RacesModule } from './races/races.module';
import { SavedSimulationsModule } from './saved-simulations/saved-simulations.module';
import { SimulationModule } from './simulation/simulation.module';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        TypeOrmModule.forRoot(buildDataSourceOptions(config.database)),
        F1ApiModule.register(config.f1Api),
        RacesModule,
        SimulationModule,
        SavedSimulationsModule,
      ],
    };
  }
}
