/** A subscription lifecycle event payload, keyed by subscription id. */
export type SubscriptionEvent = {
  subscriptionId: string;
  [key: string]: unknown;
};

/** Topics the application publishes lifecycle events to. */
export type SubscriptionEventTopic =
  | 'subscription.created'
  | 'subscription.updated';

/**
 * Driven port: publishing subscription lifecycle events.
 *
 * The application core depends on this interface; the Kafka adapter
 * (`SubscriptionEventsProducer`) implements it and is bound to
 * {@link EVENT_PUBLISHER} in the composition root.
 */
export interface EventPublisherPort {
  publishEvent(
    topic: SubscriptionEventTopic,
    event: SubscriptionEvent,
  ): Promise<void>;
}

/** DI token for {@link EventPublisherPort}. */
export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');
