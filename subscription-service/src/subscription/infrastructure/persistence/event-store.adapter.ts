import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, QueryFailedError, Repository } from 'typeorm';
import { SubscriptionDomainEvent } from '@domain/event/subscription-event';
import {
  EventStorePort,
  EventStoreConcurrencyError,
} from '@application/ports/event-store.port';
import { SubscriptionEventOrmEntity } from '@infra/persistence/subscription-event.orm-entity';
import { SubscriptionEventSerializer } from '@infra/persistence/subscription-event.serializer';

/** Postgres error code for a unique-constraint violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * TypeORM adapter for the event store.
 *
 * Appends assign each event a 1-based per-aggregate `sequence` from the loaded
 * version; a concurrent writer at the same version collides on the unique
 * `(aggregateType, aggregateId, sequence)` index, which is surfaced as a
 * retryable {@link EventStoreConcurrencyError}. `append` accepts an optional
 * {@link EntityManager} so the repository can enlist it in the save transaction
 * (the port interface stays persistence-agnostic).
 */
@Injectable()
export class EventStoreAdapter implements EventStorePort {
  constructor(
    @InjectRepository(SubscriptionEventOrmEntity)
    private readonly repo: Repository<SubscriptionEventOrmEntity>,
    private readonly serializer: SubscriptionEventSerializer,
  ) {}

  async append(
    aggregateType: string,
    aggregateId: string,
    expectedVersion: number,
    events: readonly SubscriptionDomainEvent[],
    manager?: EntityManager,
  ): Promise<void> {
    if (events.length === 0) return;

    const repo = this.repoFor(manager);
    const rows = events.map((event, index) => {
      const { eventType, payload } = this.serializer.serialize(event);
      return repo.create({
        eventId: event.eventId,
        aggregateType,
        aggregateId,
        sequence: expectedVersion + index + 1,
        eventType,
        payload,
        occurredAt: event.occurredAt,
        published: false,
      });
    });

    try {
      // save() (not insert()) so the jsonb payload types cleanly; the rows have
      // no primary key yet (global_seq is generated), so this is a plain insert.
      await repo.save(rows);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION
      ) {
        throw new EventStoreConcurrencyError(aggregateId, expectedVersion);
      }
      throw error;
    }
  }

  async loadAfter(
    aggregateType: string,
    aggregateId: string,
    afterVersion: number,
    manager?: EntityManager,
  ): Promise<SubscriptionDomainEvent[]> {
    const rows = await this.repoFor(manager).find({
      where: { aggregateType, aggregateId, sequence: MoreThan(afterVersion) },
      order: { sequence: 'ASC' },
    });
    return rows.map((row) => this.serializer.deserialize(row));
  }

  private repoFor(
    manager?: EntityManager,
  ): Repository<SubscriptionEventOrmEntity> {
    return manager
      ? manager.getRepository(SubscriptionEventOrmEntity)
      : this.repo;
  }
}
