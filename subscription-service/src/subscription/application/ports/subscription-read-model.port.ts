import { Subscription } from '@domain/subscription';

/**
 * Driven port: reads served from the subscription projection (CQRS query side).
 *
 * The query use-cases depend on this rather than on the event-sourced write
 * repository, so reads hit the materialised `subscriptions` table directly and
 * never replay the event store.
 */
export interface SubscriptionReadModelPort {
  findById(id: string): Promise<Subscription | null>;
  findActiveByUserId(userId: string): Promise<Subscription[]>;
}

/** DI token for {@link SubscriptionReadModelPort}. */
export const SUBSCRIPTION_READ_MODEL = Symbol('SUBSCRIPTION_READ_MODEL');
