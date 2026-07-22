import { v4 as uuidv4 } from 'uuid';
import { SubscriptionStatus } from './subscription-status.enum';

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
}

/** Data required to open a brand-new subscription. */
export interface NewSubscription {
  userId: string;
  planId: string;
}

/**
 * Rich domain model for a subscription — the center of the hexagon.
 *
 * Framework-free: it imports no NestJS, TypeORM or GraphQL. Persistence and
 * transport adapters map to/from this type at the edges. All lifecycle rules
 * (initial period, status transitions) live here rather than in mappers.
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

  private constructor(props: SubscriptionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.planId = props.planId;
    this.status = props.status;
    this.currentPeriodStart = props.currentPeriodStart;
    this.currentPeriodEnd = props.currentPeriodEnd;
    this.cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Opens a new ACTIVE subscription with a fresh 30-day billing period. */
  static create({ userId, planId }: NewSubscription): Subscription {
    const now = new Date();
    return new Subscription({
      id: uuidv4(),
      userId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + BILLING_PERIOD_MS),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrates a subscription from persisted state (no invariant checks). */
  static fromPersistence(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }

  /** Returns a plain snapshot of every property (for persistence/serialization). */
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
    };
  }

  /** Returns a copy with the given changes applied and `updatedAt` bumped. */
  private withChanges(changes: Partial<SubscriptionProps>): Subscription {
    return new Subscription({
      ...this.toProps(),
      ...changes,
      updatedAt: new Date(),
    });
  }

  /** Applies a partial set of externally-driven changes, bumping `updatedAt`. */
  applyUpdate(changes: {
    status?: SubscriptionStatus;
    cancelAtPeriodEnd?: boolean;
  }): Subscription {
    const patch: Partial<SubscriptionProps> = {};
    if (changes.status !== undefined) patch.status = changes.status;
    if (changes.cancelAtPeriodEnd !== undefined) {
      patch.cancelAtPeriodEnd = changes.cancelAtPeriodEnd;
    }
    return this.withChanges(patch);
  }

  /** Moves the subscription to a new status. */
  changeStatus(status: SubscriptionStatus): Subscription {
    return this.withChanges({ status });
  }

  /** Flags the subscription to cancel at the end of the current period. */
  cancelAtEndOfPeriod(): Subscription {
    return this.withChanges({ cancelAtPeriodEnd: true });
  }

  /** Cancels the subscription immediately. */
  cancel(): Subscription {
    return this.withChanges({
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: false,
    });
  }

  /** Starts the next 30-day billing period from the current period end. */
  renew(): Subscription {
    const start = this.currentPeriodEnd;
    return this.withChanges({
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: start,
      currentPeriodEnd: new Date(start.getTime() + BILLING_PERIOD_MS),
    });
  }
}
