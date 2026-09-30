import { Injectable } from '@nestjs/common';
import {
  SubscriptionDomainEvent,
  SubscriptionEventType,
} from '@domain/event/subscription-event';
import { SubscriptionEventOrmEntity } from '@infra/persistence/subscription-event.orm-entity';

/** Payload keys that carry a Date and must be revived when read from jsonb. */
const DATE_KEYS = ['currentPeriodStart', 'currentPeriodEnd', 'createdAt'];

/** Base fields stored as their own columns rather than inside the jsonb payload. */
const BASE_KEYS = ['type', 'eventId', 'subscriptionId', 'occurredAt'];

/**
 * Translates subscription domain events to/from their stored form.
 *
 * The type-specific fields live in the `payload` jsonb (dates as ISO strings);
 * the base fields (`eventId`, `aggregateId`, `occurredAt`, `event_type`) are
 * dedicated columns for indexing and querying. Deserialization reconstructs the
 * typed event by merging the columns back with the revived payload.
 */
@Injectable()
export class SubscriptionEventSerializer {
  /** Split an event into its `event_type` and its jsonb payload (dates → ISO). */
  serialize(event: SubscriptionDomainEvent): {
    eventType: SubscriptionEventType;
    payload: Record<string, unknown>;
  } {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event)) {
      if (BASE_KEYS.includes(key) || value === undefined) continue;
      payload[key] = value instanceof Date ? value.toISOString() : value;
    }
    return { eventType: event.type, payload };
  }

  /** Rebuild a typed event from a stored row, reviving payload dates. */
  deserialize(row: SubscriptionEventOrmEntity): SubscriptionDomainEvent {
    const payload: Record<string, unknown> = { ...row.payload };
    for (const key of DATE_KEYS) {
      if (typeof payload[key] === 'string') {
        payload[key] = new Date(payload[key] as string);
      }
    }
    return {
      type: row.eventType as SubscriptionEventType,
      eventId: row.eventId,
      subscriptionId: row.aggregateId,
      occurredAt: row.occurredAt,
      ...payload,
    } as SubscriptionDomainEvent;
  }
}
