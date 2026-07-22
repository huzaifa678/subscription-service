import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CreateSubscriptionInput } from '@application/dtos/create-subscription.dto';
import { Subscription } from '@domain/subscription';
import { SubscriptionCreationError } from '@domain/subscription.errors';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import type { SubscriptionRepositoryPort } from '@application/ports/subscription-repository.port';
import { CircuitBreakerService } from '@infra/resilience/circuit-breaker.service';
import { SubscriptionEventPublisher } from '@application/subscription-event.publisher';
import type { Breaker } from '@application/support/breaker';

/**
 * Use-case: open a new subscription (guarded by a circuit breaker) and publish
 * the `subscription.created` event.
 */
@Injectable()
export class CreateSubscription implements OnApplicationShutdown {
  private readonly breaker: Breaker<[CreateSubscriptionInput], Subscription>;

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
    breakerService: CircuitBreakerService,
    private readonly events: SubscriptionEventPublisher,
  ) {
    this.breaker = breakerService.create(
      (input: CreateSubscriptionInput) =>
        this.repository.save(Subscription.create(input)),
      undefined,
      () => {
        throw new ServiceUnavailableException(
          'Subscription service unavailable while creating subscription',
        );
      },
    );
  }

  async execute(input: CreateSubscriptionInput): Promise<Subscription> {
    const result = await this.breaker.fire(input);
    if (!result) throw new SubscriptionCreationError();

    await this.events.publishCreated(result);
    return result;
  }

  onApplicationShutdown() {
    this.breaker.shutdown();
  }
}
