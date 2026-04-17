import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { SubscriptionEntity } from '@model/entities/subscription.entity';
import { CreateSubscriptionInput } from '@model/dtos/create-subscription.dto';
import { UpdateSubscriptionInput } from '@model/dtos/update-subscription.dto';
import { SubscriptionService } from '@service/subscription.service';
import { trace, context } from '@opentelemetry/api';
import { WinstonLogger } from '@logger/winston.logger';

const tracer = trace.getTracer('subscription-service');

@Resolver(() => SubscriptionEntity)
export class SubscriptionResolver {
  constructor(
    private readonly service: SubscriptionService,
    private readonly logger: WinstonLogger,
  ) {}

  @Query(() => SubscriptionEntity)
  async subscription(@Args('id', { type: () => ID }) id: string) {
    this.logger.log(`subscription-resolver: findById starting for id=${id}`);
    const span = tracer.startSpan(
      'subscription.query',
      undefined,
      context.active(),
    );
    try {
      const result = await this.service.findById(id);
      this.logger.log(`subscription-resolver: findById succeeded for id=${id}`);
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      this.logger.error(
        `subscription-resolver: findById failed for id=${id}`,
        error,
      );
      span.setStatus({
        code: 2,
        message: (error as Error)?.message || 'unknown',
      });
      throw error;
    } finally {
      span.end();
    }
  }

  @Mutation(() => SubscriptionEntity)
  async createSubscription(@Args('input') input: CreateSubscriptionInput) {
    this.logger.log('subscription-resolver: createSubscription starting');
    const span = tracer.startSpan(
      'subscription.create',
      undefined,
      context.active(),
    );
    try {
      const result = await this.service.create(input);
      this.logger.log(
        `subscription-resolver: createSubscription succeeded id=${result.id}`,
      );
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      this.logger.error(
        'subscription-resolver: createSubscription failed',
        error,
      );
      span.setStatus({
        code: 2,
        message: (error as Error)?.message || 'unknown',
      });
      throw error;
    } finally {
      span.end();
    }
  }

  @Mutation(() => SubscriptionEntity)
  async updateSubscription(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSubscriptionInput,
  ) {
    this.logger.log(
      `subscription-resolver: updateSubscription starting id=${id}`,
    );
    const span = tracer.startSpan(
      'subscription.update',
      undefined,
      context.active(),
    );
    try {
      const result = await this.service.update(id, input);
      this.logger.log(
        `subscription-resolver: updateSubscription succeeded id=${id}`,
      );
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      this.logger.error(
        `subscription-resolver: updateSubscription failed id=${id}`,
        error,
      );
      span.setStatus({
        code: 2,
        message: (error as Error)?.message || 'unknown',
      });
      throw error;
    } finally {
      span.end();
    }
  }
}
