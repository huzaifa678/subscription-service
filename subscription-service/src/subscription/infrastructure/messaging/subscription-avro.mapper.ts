import { Injectable } from '@nestjs/common';
import { Subscription } from '@domain/subscription';
import { SubscriptionDomainEvent } from '@domain/event/subscription-event';
import {
  SubscriptionEvent,
  SubscriptionEventTopic,
} from '@application/ports/event-publisher.port';

/** A ready-to-send Kafka message: the topic and the Avro-friendly payload. */
export interface SubscriptionAvroMessage {
  topic: SubscriptionEventTopic;
  payload: SubscriptionEvent;
}

/**
 * Maps a stored domain event (plus the aggregate state as of that event) to the
 * Kafka message published on the subscription lifecycle topics.
 *
 * The external contract is deliberately preserved: the six granular domain events
 * collapse onto the two existing topics — `subscription.created` for the opening
 * event, `subscription.updated` for every subsequent lifecycle change — so
 * downstream consumers (e.g. billing) are unaffected by the move to event
 * sourcing. Both Avro schemas carry full state, which is why the relay supplies
 * the folded {@link Subscription} rather than the bare event delta.
 */
@Injectable()
export class SubscriptionAvroMapper {
  map(
    event: SubscriptionDomainEvent,
    state: Subscription,
  ): SubscriptionAvroMessage {
    return event.type === 'subscription.created'
      ? { topic: 'subscription.created', payload: this.created(state) }
      : { topic: 'subscription.updated', payload: this.updated(state) };
  }

  private created(s: Subscription): SubscriptionEvent {
    return {
      ...this.base(s),
      createdAt: s.createdAt.toISOString(),
    };
  }

  private updated(s: Subscription): SubscriptionEvent {
    return {
      ...this.base(s),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  /** Fields shared by both lifecycle topics (matches the registered Avro schemas). */
  private base(s: Subscription): SubscriptionEvent {
    return {
      subscriptionId: s.id,
      userId: s.userId,
      planId: s.planId,
      status: s.status,
      currentPeriodStart: s.currentPeriodStart.toISOString(),
      currentPeriodEnd: s.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    };
  }
}
