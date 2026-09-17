import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the optimistic-lock version column backing @VersionColumn on
 * SubscriptionOrmEntity. Existing rows default to 1 (matching the initial value
 * TypeORM assigns on insert).
 */
export class AddSubscriptionVersionColumn1777400000000
  implements MigrationInterface
{
  name = 'AddSubscriptionVersionColumn1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "version" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "version"`,
    );
  }
}
