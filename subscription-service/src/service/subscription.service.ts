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
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('subscription-service');

@Injectable()
export class SubscriptionService implements OnApplicationShutdown {
  private readonly logger = new Logger(SubscriptionService.name);
  private findByIdBreaker;
  private findByUserIdBreaker;
  private createBreaker;

  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly breakerService: CircuitBreakerService,
    private readonly eventsProducer: SubscriptionEventsProducer,
  ) {
    this.findByIdBreaker = this.breakerService.create(
      (id: string) => this.repository.findById(id),
      undefined,
      (id: string) => {
        throw new ServiceUnavailableException(
          `Subscription service unavailable while fetching ${id}`,
        );
      },
    );

    this.findByUserIdBreaker = this.breakerService.create(
      (userId: string) => this.repository.findActiveByUserId(userId),
      undefined,
      (userId: string) => {
        throw new ServiceUnavailableException(
          `Subscription service unavailable while fetching active subscriptions for user ${userId}`,
        );
      },
    );

    this.createBreaker = this.breakerService.create(
      (input: CreateSubscriptionInput) =>
        this.repository.createAndSave(SubscriptionMapper.toRequest(input)),
      undefined,
      () => {
        throw new ServiceUnavailableException(
          'Subscription service unavailable while creating subscription',
        );
      },
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
    const span = tracer.startSpan(
      'service.createSubscription',
      undefined,
      context.active(),
    );

    try {
      const result = await this.createBreaker.fire(input);
      if (!result)
        throw new Error(
          'Failed to create subscription (circuit breaker fallback)',
        );
      await context.with(trace.setSpan(context.active(), span), async () => {
        await this.eventsProducer.publishEvent('subscription.created', {
          subscriptionId: result.id,
          userId: result.userId,
          planId: result.planId,
          status: result.status,
          currentPeriodStart: result.currentPeriodStart.toISOString(),
          currentPeriodEnd: result.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: result.cancelAtPeriodEnd,
          createdAt: result.createdAt.toISOString(),
        });
      });

      this.logger.log(`Published subscription.created event for ${result.id}`);
      return result;
    } catch (err) {
      this.logger.error('Failed to publish subscription.created event', err);
      throw err;
    } finally {
      span.end();
    }
  }

  async update(
    id: string,
    input: UpdateSubscriptionInput,
  ): Promise<SubscriptionEntity> {
    const updated = await this.repository.update(id, input);

    try {
      await this.eventsProducer.publishEvent('subscription.updated', {
        subscriptionId: updated.id,
        userId: updated.userId,
        planId: updated.planId,
        status: updated.status,
        currentPeriodStart: updated.currentPeriodStart.toISOString(),
        currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        updatedAt: updated.updatedAt.toISOString(),
      });
      this.logger.log(`Published subscription.created event for ${updated.id}`);
    } catch (err) {
      this.logger.error('Failed to publish subscription.updated event', err);
    }
    return updated;
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Application shutdown signal received: ${signal}`);

    try {
      if (this.findByIdBreaker) {
        this.findByIdBreaker.shutdown();
        this.logger.log('findByIdBreaker shutdown completed');
      }
      if (this.createBreaker) {
        this.createBreaker.shutdown();
        this.logger.log('createBreaker shutdown completed');
      }
    } catch (err) {
      this.logger.error('Error during circuit breaker shutdown', err);
    }
  }
}
