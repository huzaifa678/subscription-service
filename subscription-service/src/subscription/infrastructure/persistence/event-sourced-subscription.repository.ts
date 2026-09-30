import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Subscription } from '@domain/subscription';
import { SubscriptionRepositoryPort } from '@application/ports/subscription-repository.port';
import { EventStoreAdapter } from '@infra/persistence/event-store.adapter';
import { SubscriptionSnapshotStoreAdapter } from '@infra/persistence/subscription-snapshot-store.adapter';
import { SubscriptionProjectionAdapter } from '@infra/persistence/subscription-projection.adapter';

/** The `aggregate_type` discriminator for subscription events in the store. */
const AGGREGATE_TYPE = 'subscription';

/** Snapshot every N events; overridable via env. */
const SNAPSHOT_INTERVAL = Number(
  process.env.SUBSCRIPTION_SNAPSHOT_INTERVAL ?? 50,
);

/**
 * Event-sourced command-side repository (bound to {@link SUBSCRIPTION_REPOSITORY}).
 *
 * `save` drains the aggregate's pending events, appends them at the expected
 * version (optimistic concurrency), upserts the read-model projection, and
 * snapshots on the every-N boundary — all in one transaction, so the event store
 * and projection commit atomically. Kafka publishing is out of band via the
 * outbox relay, so there is no persist-then-publish dual write.
 *
 * `findById` rebuilds the aggregate from its newest snapshot plus the event tail
 * (or the full stream), returning it with its version for load-modify-save flows.
 */
@Injectable()
export class EventSourcedSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventStore: EventStoreAdapter,
    private readonly snapshotStore: SubscriptionSnapshotStoreAdapter,
    private readonly projection: SubscriptionProjectionAdapter,
  ) {}

  async save(subscription: Subscription): Promise<Subscription> {
    const pending = subscription.pendingEvents();
    if (pending.length === 0) return subscription;

    const newVersion = subscription.version;
    const expectedVersion = newVersion - pending.length;

    await this.dataSource.transaction(async (manager) => {
      await this.eventStore.append(
        AGGREGATE_TYPE,
        subscription.id,
        expectedVersion,
        pending,
        manager,
      );
      await this.projection.project(subscription, manager);
      if (this.crossedSnapshotBoundary(expectedVersion, newVersion)) {
        await this.snapshotStore.save(subscription, manager);
      }
    });

    return subscription.markPersisted();
  }

  async findById(id: string): Promise<Subscription | null> {
    const snapshot = await this.snapshotStore.load(id);
    if (snapshot) {
      const tail = await this.eventStore.loadAfter(
        AGGREGATE_TYPE,
        id,
        snapshot.version,
      );
      return snapshot.replayAll(tail);
    }

    const events = await this.eventStore.loadAfter(AGGREGATE_TYPE, id, 0);
    return events.length > 0 ? Subscription.replay(events) : null;
  }

  private crossedSnapshotBoundary(
    expectedVersion: number,
    newVersion: number,
  ): boolean {
    if (SNAPSHOT_INTERVAL <= 0) return false;
    return (
      Math.floor(newVersion / SNAPSHOT_INTERVAL) >
      Math.floor(expectedVersion / SNAPSHOT_INTERVAL)
    );
  }
}
