import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Subscription, SubscriptionProps } from '@domain/subscription';
import { SubscriptionSnapshotStorePort } from '@application/ports/subscription-snapshot-store.port';
import { SubscriptionSnapshotOrmEntity } from '@infra/persistence/subscription-snapshot.orm-entity';

/**
 * TypeORM adapter for aggregate snapshots.
 *
 * Upserts a single newest snapshot per aggregate (keyed by `aggregateId`) so a
 * load reads snapshot + event tail instead of the whole stream. `save` accepts an
 * optional {@link EntityManager} so it can join the repository's save transaction.
 */
@Injectable()
export class SubscriptionSnapshotStoreAdapter implements SubscriptionSnapshotStorePort {
  constructor(
    @InjectRepository(SubscriptionSnapshotOrmEntity)
    private readonly repo: Repository<SubscriptionSnapshotOrmEntity>,
  ) {}

  async save(
    subscription: Subscription,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(SubscriptionSnapshotOrmEntity)
      : this.repo;
    const props = subscription.toProps();
    await repo.save({
      aggregateId: props.id,
      version: props.version,
      state: props,
    });
  }

  async load(id: string): Promise<Subscription | null> {
    const row = await this.repo.findOne({ where: { aggregateId: id } });
    if (!row) return null;
    return Subscription.fromSnapshot(this.reviveDates(row.state));
  }

  /** jsonb round-trips Dates as ISO strings; turn the date fields back into Dates. */
  private reviveDates(state: SubscriptionProps): SubscriptionProps {
    return {
      ...state,
      currentPeriodStart: this.toDate(state.currentPeriodStart),
      currentPeriodEnd: this.toDate(state.currentPeriodEnd),
      createdAt: this.toDate(state.createdAt),
      updatedAt: this.toDate(state.updatedAt),
    };
  }

  /** Typed as Date, but jsonb hands it back as an ISO string; normalize to Date. */
  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }
}
