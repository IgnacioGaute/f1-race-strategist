import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSavedSimulations1761600000000 implements MigrationInterface {
  name = 'CreateSavedSimulations1761600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_simulations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "race_id" character varying(64) NOT NULL,
        "race_name" character varying(200) NOT NULL,
        "model_version" character varying(32) NOT NULL,
        "total_time_seconds" double precision NOT NULL,
        "pit_stop_count" integer NOT NULL,
        "strategy" jsonb NOT NULL,
        "result" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_simulations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_simulations_created_at" ON "saved_simulations" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_saved_simulations_created_at"`);
    await queryRunner.query(`DROP TABLE "saved_simulations"`);
  }
}
