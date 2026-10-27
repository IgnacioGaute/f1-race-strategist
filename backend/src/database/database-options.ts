import type { DataSourceOptions } from 'typeorm';
import type { DatabaseConfig } from '../config/app-config';
import { SavedSimulation } from '../saved-simulations/saved-simulation.entity';
import { CreateSavedSimulations1761600000000 } from './migrations/1761600000000-CreateSavedSimulations';

export function buildDataSourceOptions(
  config: DatabaseConfig,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    // gen_random_uuid() is built into PostgreSQL 13+; no extension needed.
    uuidExtension: 'pgcrypto',
    entities: [SavedSimulation],
    migrations: [CreateSavedSimulations1761600000000],
    // Schema changes only through migrations (npm run migration:run).
    synchronize: false,
    migrationsRun: false,
  };
}
