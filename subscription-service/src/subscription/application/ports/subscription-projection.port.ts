import { Subscription } from '@domain/subscription';

/**
 * Driven port: projects an aggregate's current state into the read model.
 *
 * The event-sourced repository calls this in the same transaction as the event
 * append, upserting the `subscriptions` table so command and query sides stay
 * consistent. The projection is write-only here — the query side reads through
 * {@link SubscriptionReadModelPort}.
 */
export interface SubscriptionProjectionPort {
  project(subscription: Subscription): Promise<void>;
}

/** DI token for {@link SubscriptionProjectionPort}. */
export const SUBSCRIPTION_PROJECTION = Symbol('SUBSCRIPTION_PROJECTION');
