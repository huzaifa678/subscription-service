import { Inject, Injectable } from '@nestjs/common';
import { UpdateSubscriptionInput } from '@application/dtos/update-subscription.dto';
import { Subscription } from '@domain/subscription';
import { SubscriptionNotFoundError } from '@domain/subscription.errors';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import type { SubscriptionRepositoryPort } from '@application/ports/subscription-repository.port';
import { SubscriptionEventPublisher } from '@application/subscription-event.publisher';

/**
 * Use-case: apply changes to an existing subscription (load-modify-save through
 * the domain model) and publish the `subscription.updated` event.
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
    const existing = await this.repository.findById(id);
    if (!existing) throw new SubscriptionNotFoundError(id);

    const updated = await this.repository.save(existing.applyUpdate(input));

    await this.events.publishUpdated(updated);
    return updated;
  }
}
