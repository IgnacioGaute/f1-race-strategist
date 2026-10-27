import { DataSource } from 'typeorm';
import { loadDatabaseConfig, loadEnvFileIfPresent } from '../config/app-config';
import { buildDataSourceOptions } from './database-options';

// Entry point for the TypeORM CLI (see the migration:* npm scripts).
loadEnvFileIfPresent();

export default new DataSource(
  buildDataSourceOptions(loadDatabaseConfig(process.env)),
);
