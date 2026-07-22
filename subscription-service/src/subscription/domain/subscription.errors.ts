/** Base class for domain-level subscription errors. */
export abstract class SubscriptionDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when a subscription cannot be found by id. */
export class SubscriptionNotFoundError extends SubscriptionDomainError {
  constructor(readonly id: string) {
    super(`Subscription ${id} not found`);
  }
}

/** Raised when a user has no active subscriptions. */
export class NoActiveSubscriptionsError extends SubscriptionDomainError {
  constructor(readonly userId: string) {
    super(`No active subscriptions found for user ${userId}`);
  }
}

/** Raised when a subscription could not be created. */
export class SubscriptionCreationError extends SubscriptionDomainError {
  constructor() {
    super('Failed to create subscription');
  }
}
