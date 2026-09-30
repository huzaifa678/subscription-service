import { Inject, Injectable } from '@nestjs/common';
import { UpdateSubscriptionInput } from '@application/dtos/update-subscription.dto';
import { Subscription } from '@domain/subscription';
import {
  SubscriptionConcurrencyError,
  SubscriptionNotFoundError,
} from '@domain/subscription.errors';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import type { SubscriptionRepositoryPort } from '@application/ports/subscription-repository.port';
import { EventStoreConcurrencyError } from '@application/ports/event-store.port';

/** Load-modify-save retries before surfacing a concurrency conflict. */
const MAX_ATTEMPTS = 3;

/**
 * Use-case: apply changes to an existing subscription (load-modify-save through
 * the domain model).
 *
 * The save appends a `subscription.updated` event at the loaded aggregate
 * version; the event store's unique `(aggregate_id, sequence)` constraint gives
 * optimistic concurrency. Because the change set (status / cancelAtPeriodEnd) is
 * idempotent to re-apply, an {@link EventStoreConcurrencyError} is resolved by
 * reloading the latest stream and re-applying, up to {@link MAX_ATTEMPTS} times.
 * The `subscription.updated` Kafka event is emitted out of band by the outbox
 * relay, so there is no direct publish here.
 */
@Injectable()
export class UpdateSubscription {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
  ) {}

  async execute(
    id: string,
    input: UpdateSubscriptionInput,
  ): Promise<Subscription> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const existing = await this.repository.findById(id);
      if (!existing) throw new SubscriptionNotFoundError(id);

      try {
        return await this.repository.save(existing.applyUpdate(input));
      } catch (error) {
        if (error instanceof EventStoreConcurrencyError) {
          if (attempt < MAX_ATTEMPTS) continue; // reload the latest stream, re-apply
          throw new SubscriptionConcurrencyError(id);
        }
        throw error;
      }
    }
    // Unreachable: the loop either returns or throws on the final attempt.
    throw new SubscriptionConcurrencyError(id);
  }
}
