import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import type { SubscriptionProps } from '@domain/subscription';

/**
 * Persistence model for aggregate snapshots (`subscription_snapshot`).
 *
 * One row per aggregate (the newest snapshot), keyed by `aggregateId`. `version`
 * is the aggregate version the snapshot captures; loading it plus the events with
 * a greater sequence rebuilds the aggregate without a full replay.
 */
@Entity({ name: 'subscription_snapshot' })
export class SubscriptionSnapshotOrmEntity {
  @PrimaryColumn({ type: 'uuid', name: 'aggregate_id' })
  aggregateId!: string;

  @Column({ type: 'int' })
  version!: number;

  /** The full folded aggregate state (dates serialized as ISO strings). */
  @Column({ type: 'jsonb' })
  state!: SubscriptionProps;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
