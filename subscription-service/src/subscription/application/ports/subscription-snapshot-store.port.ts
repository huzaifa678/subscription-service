import { Subscription } from '@domain/subscription';

/**
 * Driven port: subscription snapshots, which bound replay length.
 *
 * A snapshot captures the aggregate's folded state at a given version; loading
 * it plus the events after that version rebuilds the aggregate without replaying
 * the whole stream.
 */
export interface SubscriptionSnapshotStorePort {
  /** Persist the aggregate's current state as its newest snapshot. */
  save(subscription: Subscription): Promise<void>;

  /** Load the newest snapshot for an aggregate, or null if none exists yet. */
  load(id: string): Promise<Subscription | null>;
}

/** DI token for {@link SubscriptionSnapshotStorePort}. */
export const SUBSCRIPTION_SNAPSHOT_STORE = Symbol(
  'SUBSCRIPTION_SNAPSHOT_STORE',
);
