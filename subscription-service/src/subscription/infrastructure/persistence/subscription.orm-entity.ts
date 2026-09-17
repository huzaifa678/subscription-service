import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { SubscriptionStatus } from '@domain/subscription-status.enum';

/**
 * Driven-side persistence model — the TypeORM row shape for `subscriptions`.
 *
 * Carries ONLY persistence concerns (no GraphQL, no domain behavior). The
 * repository adapter maps this to/from the domain {@link Subscription}.
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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Optimistic-lock version. TypeORM increments it on every update and adds a
   * `WHERE version = :loaded` guard, throwing OptimisticLockVersionMismatchError
   * when a concurrent write moved it on — preventing lost updates on the
   * load-modify-save path (e.g. two concurrent status/cancel changes).
   */
  @VersionColumn()
  version!: number;
}
