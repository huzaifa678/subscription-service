import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v5 as uuidv5 } from 'uuid';
import { CreateSubscriptionInput } from '@application/dtos/create-subscription.dto';
import { Subscription } from '@domain/subscription';
import { SubscriptionCreationError } from '@domain/subscription.errors';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import type { SubscriptionRepositoryPort } from '@application/ports/subscription-repository.port';
import { EventStoreConcurrencyError } from '@application/ports/event-store.port';
import { CircuitBreakerService } from '@infra/resilience/circuit-breaker.service';
import type { Breaker } from '@application/support/breaker';

/** Fixed namespace for deriving a deterministic subscription id from an Idempotency-Key. */
const IDEMPOTENCY_NAMESPACE = '8f1b6a52-3f2a-4e9c-9b7d-2a6c1e0f4d3b';

/**
 * Use-case: open a new subscription (guarded by a circuit breaker).
 *
 * The `subscription.created` event is raised by the aggregate and appended to the
 * event store by the repository; it reaches Kafka out of band via the
 * transactional-outbox relay, so this use-case no longer publishes directly (no
 * persist-then-publish dual write).
 */
@Injectable()
export class CreateSubscription implements OnApplicationShutdown {
  private readonly breaker: Breaker<[Subscription], Subscription>;

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
    breakerService: CircuitBreakerService,
  ) {
    this.breaker = breakerService.create(
      (subscription: Subscription) => this.repository.save(subscription),
      undefined,
      () => {
        throw new ServiceUnavailableException(
          'Subscription service unavailable while creating subscription',
        );
      },
    );
  }

  async execute(
    input: CreateSubscriptionInput,
    idempotencyKey?: string,
  ): Promise<Subscription> {
    const id = idempotencyKey
      ? uuidv5(`subscription:${idempotencyKey}`, IDEMPOTENCY_NAMESPACE)
      : undefined;

    try {
      const result = await this.breaker.fire(Subscription.create(input, id));
      if (!result) throw new SubscriptionCreationError();
      return result;
    } catch (error) {
      // Replay: a retry with the same key produced the same id, which collided on the event
      // store's uniqueness; return the subscription the original request created.
      if (id && error instanceof EventStoreConcurrencyError) {
        const existing = await this.repository.findById(id);
        if (existing) return existing;
      }
      throw error;
    }
  }

  onApplicationShutdown() {
    this.breaker.shutdown();
  }
}
