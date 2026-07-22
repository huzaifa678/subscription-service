import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Subscription } from '@domain/subscription';
import { SubscriptionNotFoundError } from '@domain/subscription.errors';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import type { SubscriptionRepositoryPort } from '@application/ports/subscription-repository.port';
import { CircuitBreakerService } from '@infra/resilience/circuit-breaker.service';
import type { Breaker } from '@application/support/breaker';

/** Use-case: fetch a single subscription by id, guarded by a circuit breaker. */
@Injectable()
export class GetSubscription implements OnApplicationShutdown {
  private readonly breaker: Breaker<[string], Subscription | null>;

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
    breakerService: CircuitBreakerService,
  ) {
    this.breaker = breakerService.create(
      (id: string) => this.repository.findById(id),
      undefined,
      (id: string) => {
        throw new ServiceUnavailableException(
          `Subscription service unavailable while fetching ${id}`,
        );
      },
    );
  }

  async execute(id: string): Promise<Subscription> {
    const result = await this.breaker.fire(id);
    if (!result) throw new SubscriptionNotFoundError(id);
    return result;
  }

  onApplicationShutdown() {
    this.breaker.shutdown();
  }
}
