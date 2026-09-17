import { Inject, Injectable } from '@nestjs/common';
import { OptimisticLockVersionMismatchError } from 'typeorm';
import { UpdateSubscriptionInput } from '@application/dtos/update-subscription.dto';
import { Subscription } from '@domain/subscription';
import {
  SubscriptionConcurrencyError,
  SubscriptionNotFoundError,
} from '@domain/subscription.errors';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import type { SubscriptionRepositoryPort } from '@application/ports/subscription-repository.port';
import { SubscriptionEventPublisher } from '@application/subscription-event.publisher';

/** Load-modify-save retries before surfacing a concurrency conflict. */
const MAX_ATTEMPTS = 3;

/**
 * Use-case: apply changes to an existing subscription (load-modify-save through
 * the domain model) and publish the `subscription.updated` event.
 *
 * The save is guarded by the entity's optimistic-lock version. Because the
 * change set (status / cancelAtPeriodEnd) is idempotent to re-apply, a version
 * conflict is resolved by reloading the latest row and re-applying, up to
 * {@link MAX_ATTEMPTS} times before surfacing a conflict.
 */
@Injectable()
export class UpdateSubscription {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
    private readonly events: SubscriptionEventPublisher,
  ) {}

  async execute(
    id: string,
    input: UpdateSubscriptionInput,
  ): Promise<Subscription> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const existing = await this.repository.findById(id);
      if (!existing) throw new SubscriptionNotFoundError(id);

      try {
        const updated = await this.repository.save(existing.applyUpdate(input));
        await this.events.publishUpdated(updated);
        return updated;
      } catch (error) {
        if (
          error instanceof OptimisticLockVersionMismatchError &&
          attempt < MAX_ATTEMPTS
        ) {
          continue; // reload the latest version and re-apply
        }
        if (error instanceof OptimisticLockVersionMismatchError) {
          throw new SubscriptionConcurrencyError(id);
        }
        throw error;
      }
    }
    // Unreachable: the loop either returns or throws on the final attempt.
    throw new SubscriptionConcurrencyError(id);
  }
}
