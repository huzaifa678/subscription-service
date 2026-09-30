import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the snapshot table that bounds subscription replay length. One row per
 * aggregate (the newest snapshot); loading it plus the events with a greater
 * `sequence` rebuilds the aggregate without replaying the whole stream.
 */
export class CreateSubscriptionSnapshot1780000000001
  implements MigrationInterface
{
  name = 'CreateSubscriptionSnapshot1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription_snapshot" (
        "aggregate_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "state" jsonb NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_snapshot" PRIMARY KEY ("aggregate_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "subscription_snapshot"`);
  }
}
