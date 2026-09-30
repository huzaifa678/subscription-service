import { v4 as uuidv4 } from 'uuid';
import { SubscriptionStatus } from './subscription-status.enum';
import {
  SubscriptionCreatedEvent,
  SubscriptionDomainEvent,
} from './event/subscription-event';

/** Default billing period length: 30 days. */
const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** All persistable properties of a subscription. */
export interface SubscriptionProps {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Aggregate version = number of events folded into this state. It is the
   * optimistic-concurrency token: a write appends at `version - pending` and the
   * event store's unique `(aggregate_id, sequence)` rejects a stale writer.
   */
  version: number;
}

/** Data required to open a brand-new subscription. */
export interface NewSubscription {
  userId: string;
  planId: string;
}

/**
 * Rich, event-sourced domain model for a subscription — the center of the hexagon.
 *
 * Framework-free: it imports no NestJS, TypeORM or GraphQL. State is the fold of
 * an append-only event stream rather than a mutable row. Command methods
 * ({@link create}, {@link applyUpdate}, {@link changeStatus}, {@link cancel}, …)
 * raise a domain event and return a new immutable instance carrying it as
 * *pending*; the repository drains the pending events, appends them to the store,
 * and projects the read model. Rebuild happens via {@link replay} /
 * {@link fromSnapshot} + {@link replayAll}.
 */
export class Subscription {
  readonly id: string;
  readonly userId: string;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
  readonly cancelAtPeriodEnd: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;

  /** Events raised since load, awaiting append. Empty on a rehydrated aggregate. */
  private readonly pending: readonly SubscriptionDomainEvent[];

  private constructor(
    props: SubscriptionProps,
    pending: readonly SubscriptionDomainEvent[] = [],
  ) {
    this.id = props.id;
    this.userId = props.userId;
    this.planId = props.planId;
    this.status = props.status;
    this.currentPeriodStart = props.currentPeriodStart;
    this.currentPeriodEnd = props.currentPeriodEnd;
    this.cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.version = props.version;
    this.pending = pending;
  }

  // --- Commands (raise events) ---------------------------------------------

  /** Opens a new ACTIVE subscription with a fresh 30-day billing period. */
  static create({ userId, planId }: NewSubscription): Subscription {
    const now = new Date();
    const id = uuidv4();
    const created: SubscriptionCreatedEvent = {
      type: 'subscription.created',
      eventId: uuidv4(),
      subscriptionId: id,
      occurredAt: now,
      userId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + BILLING_PERIOD_MS),
      cancelAtPeriodEnd: false,
      createdAt: now,
    };
    return Subscription.seed(id).raise(created);
  }

  /** Applies a partial set of externally-driven changes (status / cancel flag). */
  applyUpdate(changes: {
    status?: SubscriptionStatus;
    cancelAtPeriodEnd?: boolean;
  }): Subscription {
    return this.raise({
      type: 'subscription.updated',
      ...this.header(),
      status: changes.status,
      cancelAtPeriodEnd: changes.cancelAtPeriodEnd,
    });
  }

  /** Moves the subscription to a new status. */
  changeStatus(status: SubscriptionStatus): Subscription {
    return this.raise({
      type: 'subscription.status-changed',
      ...this.header(),
      status,
    });
  }

  /** Flags the subscription to cancel at the end of the current period. */
  cancelAtEndOfPeriod(): Subscription {
    return this.raise({
      type: 'subscription.cancellation-scheduled',
      ...this.header(),
    });
  }

  /** Cancels the subscription immediately. */
  cancel(): Subscription {
    return this.raise({ type: 'subscription.canceled', ...this.header() });
  }

  /** Starts the next 30-day billing period from the current period end. */
  renew(): Subscription {
    const start = this.currentPeriodEnd;
    return this.raise({
      type: 'subscription.renewed',
      ...this.header(),
      currentPeriodStart: start,
      currentPeriodEnd: new Date(start.getTime() + BILLING_PERIOD_MS),
    });
  }

  // --- Rehydration ----------------------------------------------------------

  /** Rebuilds a subscription by folding its full event stream. */
  static replay(events: readonly SubscriptionDomainEvent[]): Subscription {
    if (events.length === 0) {
      throw new Error(
        'Cannot replay a subscription from an empty event stream',
      );
    }
    return Subscription.seed(events[0].subscriptionId).replayAll(events);
  }

  /** Rebuilds from a persisted snapshot (no pending events, no invariant checks). */
  static fromSnapshot(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }

  /**
   * Rebuilds from a projection row for the read side (no pending events, no
   * invariant checks). Structurally identical to {@link fromSnapshot} but named
   * for its call site — the query path reads the materialised projection.
   */
  static fromPersistence(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }

  /** Folds a tail of events onto this state (used after loading a snapshot). */
  replayAll(events: readonly SubscriptionDomainEvent[]): Subscription {
    return events.reduce<Subscription>(
      (agg, event) => agg.fold(event, false),
      this,
    );
  }

  // --- Pending-event lifecycle ---------------------------------------------

  /** Events raised since load, in order, awaiting append to the store. */
  pendingEvents(): readonly SubscriptionDomainEvent[] {
    return this.pending;
  }

  /** Returns a copy with the pending events cleared (after a successful append). */
  markPersisted(): Subscription {
    return new Subscription(this.toProps());
  }

  // --- Serialization --------------------------------------------------------

  /** Returns a plain snapshot of every property (for persistence/projection). */
  toProps(): SubscriptionProps {
    return {
      id: this.id,
      userId: this.userId,
      planId: this.planId,
      status: this.status,
      currentPeriodStart: this.currentPeriodStart,
      currentPeriodEnd: this.currentPeriodEnd,
      cancelAtPeriodEnd: this.cancelAtPeriodEnd,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }

  // --- Internals ------------------------------------------------------------

  /** The base fields shared by every event raised from an existing aggregate. */
  private header(): {
    eventId: string;
    subscriptionId: string;
    occurredAt: Date;
  } {
    return {
      eventId: uuidv4(),
      subscriptionId: this.id,
      occurredAt: new Date(),
    };
  }

  /** Applies an event as a new command: folds it and tracks it as pending. */
  private raise(event: SubscriptionDomainEvent): Subscription {
    return this.fold(event, true);
  }

  /**
   * The single reducer: derives the next state from an event and bumps the
   * version. `track` distinguishes a freshly-raised command (append later) from a
   * replayed event (already durable).
   */
  private fold(event: SubscriptionDomainEvent, track: boolean): Subscription {
    const next = this.apply(event);
    const props: SubscriptionProps = {
      ...next,
      updatedAt: this.updatedAtFor(event),
      version: this.version + 1,
    };
    return new Subscription(
      props,
      track ? [...this.pending, event] : this.pending,
    );
  }

  /** Pure state transition for one event (no version/pending concerns). */
  private apply(
    event: SubscriptionDomainEvent,
  ): Omit<SubscriptionProps, 'version' | 'updatedAt'> {
    const base = this.toProps();
    switch (event.type) {
      case 'subscription.created':
        return {
          id: event.subscriptionId,
          userId: event.userId,
          planId: event.planId,
          status: event.status,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd,
          createdAt: event.createdAt,
        };
      case 'subscription.status-changed':
        return { ...base, status: event.status };
      case 'subscription.cancellation-scheduled':
        return { ...base, cancelAtPeriodEnd: true };
      case 'subscription.canceled':
        return {
          ...base,
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: false,
        };
      case 'subscription.renewed':
        return {
          ...base,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
        };
      case 'subscription.updated':
        return {
          ...base,
          status: event.status ?? base.status,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd ?? base.cancelAtPeriodEnd,
        };
    }
  }

  /** `updatedAt` tracks the latest event time; `created` sets it to createdAt. */
  private updatedAtFor(event: SubscriptionDomainEvent): Date {
    return event.type === 'subscription.created'
      ? event.createdAt
      : event.occurredAt;
  }

  /** The empty seed an aggregate is folded onto — every field is overwritten. */
  private static seed(id: string): Subscription {
    const epoch = new Date(0);
    return new Subscription({
      id,
      userId: '',
      planId: '',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: epoch,
      currentPeriodEnd: epoch,
      cancelAtPeriodEnd: false,
      createdAt: epoch,
      updatedAt: epoch,
      version: 0,
    });
  }
}
