import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { SubscriptionStatus } from '@domain/subscription-status.enum';

/**
 * Driven-side persistence model — the TypeORM row shape for `subscriptions`.
 *
 * This table is now the **CQRS read-model projection**: the event store is the
 * source of truth, and the event-sourced repository upserts this row (verbatim
 * from the aggregate) in the same transaction as the event append. Consequently
 * `version` / `createdAt` / `updatedAt` mirror the aggregate's own values rather
 * than being TypeORM-managed — optimistic concurrency lives in the event store's
 * unique `(aggregate_id, sequence)`, not in a `@VersionColumn` here.
 *
 * Carries ONLY persistence concerns (no GraphQL, no domain behavior). The
 * projection adapter maps this to/from the domain {@link Subscription}.
 */
@Entity({ name: 'subscriptions' })
@Index(['userId'])
@Index(['status'])
@Index(['currentPeriodEnd'])
@Index(['userId', 'status'])
export class SubscriptionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('text')
  planId!: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({ type: 'timestamptz' })
  currentPeriodStart!: Date;

  @Column({ type: 'timestamptz' })
  currentPeriodEnd!: Date;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Aggregate version, mirrored from the event stream (event count). Plain column
   * — not a `@VersionColumn` — because the projection is written by upsert, not by
   * TypeORM's optimistic-lock save path; concurrency is enforced upstream in the
   * event store.
   */
  @Column({ type: 'int', default: 1 })
  version!: number;
}
