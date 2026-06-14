import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CreateSubscriptionInput } from '@model/dtos/create-subscription.dto';
import { UpdateSubscriptionInput } from '@model/dtos/update-subscription.dto';
import { SubscriptionEntity } from '@model/entities/subscription.entity';
import { SubscriptionMapper } from '@mapper/subscription.mapper';
import { SubscriptionRepository } from '@repository/subscription.repository';
import { CircuitBreakerService } from '@service/circuit-breaker.service';
import { SubscriptionEventsProducer } from '@events/subscription.event.producer';
import { withSpan } from '@lib/tracing';

/** Minimal shape the service needs from an opossum breaker. */
interface Breaker<TArgs extends unknown[], TResult> {
  fire(...args: TArgs): Promise<TResult>;
  shutdown(): void;
}

/** A subscription lifecycle event payload, as accepted by the events producer. */
type SubscriptionEvent = { subscriptionId: string; [key: string]: unknown };

@Injectable()
export class SubscriptionService implements OnApplicationShutdown {
  private readonly logger = new Logger(SubscriptionService.name);

  /** Every breaker the service owns, so shutdown can drain them all (OCP). */
  private readonly breakers: Array<{ shutdown(): void }> = [];

  private readonly findByIdBreaker: Breaker<
    [string],
    SubscriptionEntity | null
  >;
  private readonly findByUserIdBreaker: Breaker<[string], SubscriptionEntity[]>;
  private readonly createBreaker: Breaker<
    [CreateSubscriptionInput],
    SubscriptionEntity
  >;

  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly breakerService: CircuitBreakerService,
    private readonly eventsProducer: SubscriptionEventsProducer,
  ) {
    this.findByIdBreaker = this.registerBreaker(
      this.breakerService.create(
        (id: string) => this.repository.findById(id),
        undefined,
        (id: string) =>
          this.unavailable(
            `Subscription service unavailable while fetching ${id}`,
          ),
      ),
    );

    this.findByUserIdBreaker = this.registerBreaker(
      this.breakerService.create(
        (userId: string) => this.repository.findActiveByUserId(userId),
        undefined,
        (userId: string) =>
          this.unavailable(
            `Subscription service unavailable while fetching active subscriptions for user ${userId}`,
          ),
      ),
    );

    this.createBreaker = this.registerBreaker(
      this.breakerService.create(
        (input: CreateSubscriptionInput) =>
          this.repository.createAndSave(SubscriptionMapper.toRequest(input)),
        undefined,
        () =>
          this.unavailable(
            'Subscription service unavailable while creating subscription',
          ),
      ),
    );
  }

  async findById(id: string): Promise<SubscriptionEntity> {
    const result = await this.findByIdBreaker.fire(id);
    if (!result)
      throw new Error('Subscription not found (circuit breaker fallback)');
    return result;
  }

  async findActiveByUserId(userId: string): Promise<SubscriptionEntity[]> {
    const result = await this.findByUserIdBreaker.fire(userId);

    if (!result || result.length === 0) {
      throw new Error(
        'No active subscriptions found (circuit breaker fallback)',
      );
    }

    return result;
  }

  async create(input: CreateSubscriptionInput): Promise<SubscriptionEntity> {
    const result = await this.createBreaker.fire(input);
    if (!result)
      throw new Error(
        'Failed to create subscription (circuit breaker fallback)',
      );

    await this.publish(
      'subscription.created',
      'service.createSubscription',
      SubscriptionMapper.toCreatedEvent(result),
      result.id,
      { rethrow: true },
    );

    return result;
  }

  async update(
    id: string,
    input: UpdateSubscriptionInput,
  ): Promise<SubscriptionEntity> {
    const updated = await this.repository.update(id, input);

    await this.publish(
      'subscription.updated',
      'service.updateSubscription',
      SubscriptionMapper.toUpdatedEvent(updated),
      updated.id,
      { rethrow: false },
    );

    return updated;
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Application shutdown signal received: ${signal}`);

    for (const breaker of this.breakers) {
      try {
        breaker.shutdown();
      } catch (err) {
        this.logger.error('Error during circuit breaker shutdown', err);
      }
    }
  }

  private registerBreaker<TArgs extends unknown[], TResult>(
    breaker: Breaker<TArgs, TResult>,
  ): Breaker<TArgs, TResult> {
    this.breakers.push(breaker);
    return breaker;
  }

  private unavailable(message: string): never {
    throw new ServiceUnavailableException(message);
  }

  /** Publishes a lifecycle event inside a traced span with uniform logging. */
  private async publish(
    topic: 'subscription.created' | 'subscription.updated',
    spanName: string,
    payload: SubscriptionEvent,
    subscriptionId: string,
    { rethrow }: { rethrow: boolean },
  ): Promise<void> {
    try {
      await withSpan(spanName, () =>
        this.eventsProducer.publishEvent(topic, payload),
      );
      this.logger.log(`Published ${topic} event for ${subscriptionId}`);
    } catch (err) {
      this.logger.error(`Failed to publish ${topic} event`, err);
      if (rethrow) throw err;
    }
  }
}
