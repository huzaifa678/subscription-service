import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Subscription } from '@domain/subscription';
import { NoActiveSubscriptionsError } from '@domain/subscription.errors';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import type { SubscriptionRepositoryPort } from '@application/ports/subscription-repository.port';
import { CircuitBreakerService } from '@infra/resilience/circuit-breaker.service';
import type { Breaker } from '@application/support/breaker';

/** Use-case: list a user's active subscriptions, guarded by a circuit breaker. */
@Injectable()
export class GetUserActiveSubscriptions implements OnApplicationShutdown {
  private readonly breaker: Breaker<[string], Subscription[]>;

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
    breakerService: CircuitBreakerService,
  ) {
    this.breaker = breakerService.create(
      (userId: string) => this.repository.findActiveByUserId(userId),
      undefined,
      (userId: string) => {
        throw new ServiceUnavailableException(
          `Subscription service unavailable while fetching active subscriptions for user ${userId}`,
        );
      },
    );
  }

  async execute(userId: string): Promise<Subscription[]> {
    const result = await this.breaker.fire(userId);
    if (!result || result.length === 0) {
      throw new NoActiveSubscriptionsError(userId);
    }
    return result;
  }

  onApplicationShutdown() {
    this.breaker.shutdown();
  }
}
