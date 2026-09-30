import { SubscriptionDomainEvent } from '@domain/event/subscription-event';

/**
 * Driven port: the append-only event store, the source of truth for aggregates.
 *
 * The store owns per-aggregate sequencing; callers pass the version they loaded
 * and the store rejects a stale writer via its unique `(aggregate_id, sequence)`
 * constraint, giving optimistic concurrency without row locks.
 */
export interface EventStorePort {
  /**
   * Append `events` for one aggregate, expecting its stream to currently be at
   * `expectedVersion`. Rejects (throws) if a concurrent writer already advanced
   * it, so the load-modify-save caller can reload and retry.
   */
  append(
    aggregateType: string,
    aggregateId: string,
    expectedVersion: number,
    events: readonly SubscriptionDomainEvent[],
  ): Promise<void>;

  /**
   * Load the events for an aggregate whose sequence is greater than
   * `afterVersion` (0 loads the full stream), in ascending sequence order.
   */
  loadAfter(
    aggregateType: string,
    aggregateId: string,
    afterVersion: number,
  ): Promise<SubscriptionDomainEvent[]>;
}

/** DI token for {@link EventStorePort}. */
export const EVENT_STORE = Symbol('EVENT_STORE');

/**
 * Thrown by {@link EventStorePort.append} when a concurrent writer already
 * advanced the aggregate's stream past `expectedVersion` (the unique
 * `(aggregate_id, sequence)` constraint rejected the append). It is the
 * retryable signal a load-modify-save flow reloads on; after exhausting retries
 * the use-case surfaces the terminal `SubscriptionConcurrencyError`.
 */
export class EventStoreConcurrencyError extends Error {
  constructor(
    readonly aggregateId: string,
    readonly expectedVersion: number,
  ) {
    super(
      `Concurrent write on aggregate ${aggregateId} at version ${expectedVersion}`,
    );
    this.name = 'EventStoreConcurrencyError';
  }
}
