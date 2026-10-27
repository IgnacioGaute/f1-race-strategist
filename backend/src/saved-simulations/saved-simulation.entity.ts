import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  SimulationResult,
  StrategyStint,
} from '../simulation/simulation.types';

/**
 * A simulation the user chose to keep. Strategy and result are stored as JSONB
 * snapshots; total time and stop count are duplicated as columns so the history
 * list does not need to load the full lap-by-lap result.
 */
@Entity({ name: 'saved_simulations' })
export class SavedSimulation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_saved_simulations_id',
  })
  id!: string;

  @Column({ name: 'race_id', type: 'varchar', length: 64 })
  raceId!: string;

  @Column({ name: 'race_name', type: 'varchar', length: 200 })
  raceName!: string;

  @Column({ name: 'model_version', type: 'varchar', length: 32 })
  modelVersion!: string;

  @Column({ name: 'total_time_seconds', type: 'double precision' })
  totalTimeSeconds!: number;

  @Column({ name: 'pit_stop_count', type: 'integer' })
  pitStopCount!: number;

  @Column({ type: 'jsonb' })
  strategy!: StrategyStint[];

  @Column({ type: 'jsonb' })
  result!: SimulationResult;

  @Index('IDX_saved_simulations_created_at')
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
