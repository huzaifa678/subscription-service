import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the append-only event store backing subscription event sourcing.
 *
 * `global_seq` is the monotonic append order the outbox relay drains by. The
 * unique `(aggregate_type, aggregate_id, sequence)` index is the optimistic-
 * concurrency guard; the partial index on unpublished rows backs the relay poll.
 */
export class CreateSubscriptionEventStore1780000000000 implements MigrationInterface {
  name = 'CreateSubscriptionEventStore1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription_event_store" (
        "global_seq" BIGSERIAL NOT NULL,
        "event_id" uuid NOT NULL,
        "aggregate_type" character varying(64) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "sequence" integer NOT NULL,
        "event_type" character varying(64) NOT NULL,
        "payload" jsonb NOT NULL,
        "occurred_at" timestamptz NOT NULL,
        "published" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_event_store" PRIMARY KEY ("global_seq")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscription_event_event_id" ON "subscription_event_store" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscription_event_aggregate_sequence" ON "subscription_event_store" ("aggregate_type", "aggregate_id", "sequence")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_subscription_event_unpublished" ON "subscription_event_store" ("global_seq") WHERE "published" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."ix_subscription_event_unpublished"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_subscription_event_aggregate_sequence"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_subscription_event_event_id"`,
    );
    await queryRunner.query(`DROP TABLE "subscription_event_store"`);
  }
}
