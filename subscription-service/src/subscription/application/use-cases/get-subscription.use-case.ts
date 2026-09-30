import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Subscription } from '@domain/subscription';
import { SubscriptionNotFoundError } from '@domain/subscription.errors';
import { SUBSCRIPTION_READ_MODEL } from '@application/ports/subscription-read-model.port';
import type { SubscriptionReadModelPort } from '@application/ports/subscription-read-model.port';
import { CircuitBreakerService } from '@infra/resilience/circuit-breaker.service';
import type { Breaker } from '@application/support/breaker';

/**
 * Use-case: fetch a single subscription by id, guarded by a circuit breaker.
 *
 * Reads the CQRS projection through {@link SubscriptionReadModelPort} — no event
 * replay on the query path.
 */
@Injectable()
export class GetSubscription implements OnApplicationShutdown {
  private readonly breaker: Breaker<[string], Subscription | null>;

  constructor(
    @Inject(SUBSCRIPTION_READ_MODEL)
    private readonly readModel: SubscriptionReadModelPort,
    breakerService: CircuitBreakerService,
  ) {
    this.breaker = breakerService.create(
      (id: string) => this.readModel.findById(id),
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
