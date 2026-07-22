import { Subscription } from '@domain/subscription';

/**
 * Maps a domain {@link Subscription} to the Avro-friendly event payloads
 * published on the subscription lifecycle topics.
 */
export class SubscriptionMapper {
  /** Fields shared by every subscription lifecycle event. */
  private static toEventBase(subscription: Subscription) {
    return {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  static toCreatedEvent(subscription: Subscription) {
    return {
      ...this.toEventBase(subscription),
      createdAt: subscription.createdAt.toISOString(),
    };
  }

  static toUpdatedEvent(subscription: Subscription) {
    return {
      ...this.toEventBase(subscription),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }
}
