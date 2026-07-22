import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { SubscriptionEntity } from '@model/entities/subscription.entity';
import { CreateSubscriptionInput } from '@model/dtos/create-subscription.dto';
import { UpdateSubscriptionInput } from '@model/dtos/update-subscription.dto';
import { SubscriptionService } from '@service/subscription.service';
import { withSpan } from '@lib/tracing';
import { WinstonLogger } from '@logger/winston.logger';

@Resolver(() => SubscriptionEntity)
export class SubscriptionResolver {
  constructor(
    private readonly service: SubscriptionService,
    private readonly logger: WinstonLogger,
  ) {}

  @Query(() => SubscriptionEntity)
  subscription(@Args('id', { type: () => ID }) id: string) {
    return this.trace(`findById id=${id}`, 'subscription.query', () =>
      this.service.findById(id),
    );
  }

  @Mutation(() => SubscriptionEntity)
  createSubscription(@Args('input') input: CreateSubscriptionInput) {
    return this.trace('createSubscription', 'subscription.create', () =>
      this.service.create(input),
    );
  }

  @Mutation(() => SubscriptionEntity)
  updateSubscription(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSubscriptionInput,
  ) {
    return this.trace(
      `updateSubscription id=${id}`,
      'subscription.update',
      () => this.service.update(id, input),
    );
  }

  /** Wraps a resolver action with a span plus uniform start/success/failure logs. */
  private async trace<T>(
    label: string,
    spanName: string,
    action: () => Promise<T>,
  ): Promise<T> {
    this.logger.log(`subscription-resolver: ${label} starting`);
    try {
      const result = await withSpan(spanName, action);
      this.logger.log(`subscription-resolver: ${label} succeeded`);
      return result;
    } catch (error) {
      this.logger.error(`subscription-resolver: ${label} failed`, error);
      throw error;
    }
  }
}
