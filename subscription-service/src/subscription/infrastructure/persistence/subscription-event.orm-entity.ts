import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  CreateDateColumn,
} from 'typeorm';

/**
 * Persistence model for the append-only event store (`subscription_event_store`).
 *
 * `globalSeq` is the monotonic append order the outbox relay drains by. The
 * unique `(aggregateType, aggregateId, sequence)` is the optimistic-concurrency
 * guard: two writers loading the same version cannot both append. `published`
 * plus the partial index back the outbox poll.
 */
@Entity({ name: 'subscription_event_store' })
@Unique('uq_subscription_event_aggregate_sequence', [
  'aggregateType',
  'aggregateId',
  'sequence',
])
@Index('ix_subscription_event_unpublished', ['globalSeq'], {
  where: 'published = false',
})
export class SubscriptionEventOrmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'global_seq' })
  globalSeq!: string;

  @Column({ type: 'uuid', name: 'event_id', unique: true })
  eventId!: string;

  @Column({ type: 'varchar', length: 64, name: 'aggregate_type' })
  aggregateType!: string;

  @Column({ type: 'uuid', name: 'aggregate_id' })
  aggregateId!: string;

  @Column({ type: 'int' })
  sequence!: number;

  @Column({ type: 'varchar', length: 64, name: 'event_type' })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'boolean', default: false })
  published!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
