import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSubscriptionsTable1776322948831 implements MigrationInterface {
    name = 'CreateSubscriptionsTable1776322948831'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_f2a37d226c4f58242548e53c6b" ON "subscriptions" ("userId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_a52decd5a2fd2bd8215c503606" ON "subscriptions" ("currentPeriodEnd") `);
        await queryRunner.query(`CREATE INDEX "IDX_6ccf973355b70645eff37774de" ON "subscriptions" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_fbdba4e2ac694cf8c9cecf4dc8" ON "subscriptions" ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fbdba4e2ac694cf8c9cecf4dc8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ccf973355b70645eff37774de"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a52decd5a2fd2bd8215c503606"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f2a37d226c4f58242548e53c6b"`);
    }

}
