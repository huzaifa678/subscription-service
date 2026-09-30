import { Subscription } from '@domain/subscription';

/**
 * Driven port: the command-side (write) repository for subscriptions, backed by
 * the event store.
 *
 * The application core depends on this interface, never on a concrete database
 * adapter. The event-sourced adapter (`EventSourcedSubscriptionRepository`)
 * implements it and is bound to {@link SUBSCRIPTION_REPOSITORY} in the
 * composition root. Reads for the query side go through
 * `SubscriptionReadModelPort` instead; `findById` here rebuilds the aggregate
 * (with its version) from the store to feed load-modify-save command flows.
 */
export interface SubscriptionRepositoryPort {
  /** Rebuild an aggregate from its snapshot + event tail, or null if unknown. */
  findById(id: string): Promise<Subscription | null>;

  /** Append the aggregate's pending events, project the read model, snapshot. */
  save(subscription: Subscription): Promise<Subscription>;
}

/** DI token for {@link SubscriptionRepositoryPort}. */
export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
