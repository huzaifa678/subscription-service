import { Subscription } from '@domain/subscription';

/**
 * Driven port: persistence for subscriptions.
 *
 * The application core depends on this interface, never on a concrete
 * database adapter. The TypeORM adapter (`SubscriptionRepository`) implements
 * it and is bound to {@link SUBSCRIPTION_REPOSITORY} in the composition root.
 * It speaks the framework-free domain {@link Subscription} in both directions.
 */
export interface SubscriptionRepositoryPort {
  findById(id: string): Promise<Subscription | null>;
  findActiveByUserId(userId: string): Promise<Subscription[]>;
  /** Inserts or updates a subscription aggregate, returning the stored state. */
  save(subscription: Subscription): Promise<Subscription>;
}

/** DI token for {@link SubscriptionRepositoryPort}. */
export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
