import { SubscriptionStatus } from '@domain/subscription-status.enum';

/**
 * Fields carried by every subscription domain event.
 *
 * Events are the source of truth for the aggregate: state is the fold of the
 * stream. They stay pure — the event store assigns each event its per-aggregate
 * `sequence`, so the domain never deals with sequencing or persistence concerns.
 * `occurredAt` is the domain timestamp; it is preserved verbatim on replay.
 */
export interface SubscriptionEventBase {
  readonly eventId: string;
  readonly subscriptionId: string;
  readonly occurredAt: Date;
}

/** A subscription was opened. Carries the full initial state (the fold seed). */
export interface SubscriptionCreatedEvent extends SubscriptionEventBase {
  readonly type: 'subscription.created';
  readonly userId: string;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
  readonly cancelAtPeriodEnd: boolean;
  readonly createdAt: Date;
}

/** The subscription moved to a new status. */
export interface SubscriptionStatusChangedEvent extends SubscriptionEventBase {
  readonly type: 'subscription.status-changed';
  readonly status: SubscriptionStatus;
}

/** The subscription was flagged to cancel at the end of the current period. */
export interface SubscriptionCancellationScheduledEvent extends SubscriptionEventBase {
  readonly type: 'subscription.cancellation-scheduled';
}

/** The subscription was canceled immediately. */
export interface SubscriptionCanceledEvent extends SubscriptionEventBase {
  readonly type: 'subscription.canceled';
}

/** A new billing period started. */
export interface SubscriptionRenewedEvent extends SubscriptionEventBase {
  readonly type: 'subscription.renewed';
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
}

/** An externally-driven patch (status and/or cancel-at-period-end) was applied. */
export interface SubscriptionUpdatedEvent extends SubscriptionEventBase {
  readonly type: 'subscription.updated';
  readonly status?: SubscriptionStatus;
  readonly cancelAtPeriodEnd?: boolean;
}

/**
 * The closed set of subscription domain events — a discriminated union on
 * `type`. Exhaustive `switch (event.type)` handling gives the same compile-time
 * safety a sealed hierarchy would, so adding a case here surfaces every fold and
 * mapper that must handle it.
 */
export type SubscriptionDomainEvent =
  | SubscriptionCreatedEvent
  | SubscriptionStatusChangedEvent
  | SubscriptionCancellationScheduledEvent
  | SubscriptionCanceledEvent
  | SubscriptionRenewedEvent
  | SubscriptionUpdatedEvent;

/** Every concrete event `type` discriminator, for serializer/mapper registries. */
export type SubscriptionEventType = SubscriptionDomainEvent['type'];
