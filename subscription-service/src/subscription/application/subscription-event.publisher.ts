import { Inject, Injectable, Logger } from '@nestjs/common';
import { Subscription } from '@domain/subscription';
import { SubscriptionMapper } from '@application/subscription.mapper';
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port';
import type {
  EventPublisherPort,
  SubscriptionEvent,
  SubscriptionEventTopic,
} from '@application/ports/event-publisher.port';
import { withSpan } from '@lib/tracing';

/**
 * Application service that publishes subscription lifecycle events through the
 * {@link EventPublisherPort}, wrapping each publish in a traced span with
 * uniform logging. Shared by the create/update use-cases.
 */
@Injectable()
export class SubscriptionEventPublisher {
  private readonly logger = new Logger(SubscriptionEventPublisher.name);

  constructor(
    @Inject(EVENT_PUBLISHER)
    private readonly producer: EventPublisherPort,
  ) {}

  /** Publishes `subscription.created`; failures are rethrown to the caller. */
  publishCreated(subscription: Subscription): Promise<void> {
    return this.publish(
      'subscription.created',
      'service.createSubscription',
      SubscriptionMapper.toCreatedEvent(subscription),
      subscription.id,
      { rethrow: true },
    );
  }

  /** Publishes `subscription.updated`; failures are logged and swallowed. */
  publishUpdated(subscription: Subscription): Promise<void> {
    return this.publish(
      'subscription.updated',
      'service.updateSubscription',
      SubscriptionMapper.toUpdatedEvent(subscription),
      subscription.id,
      { rethrow: false },
    );
  }

  private async publish(
    topic: SubscriptionEventTopic,
    spanName: string,
    payload: SubscriptionEvent,
    subscriptionId: string,
    { rethrow }: { rethrow: boolean },
  ): Promise<void> {
    try {
      await withSpan(spanName, () =>
        this.producer.publishEvent(topic, payload),
      );
      this.logger.log(`Published ${topic} event for ${subscriptionId}`);
    } catch (err) {
      this.logger.error(`Failed to publish ${topic} event`, err);
      if (rethrow) throw err;
    }
  }
}
