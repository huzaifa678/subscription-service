import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { SubscriptionType } from '@interface/graphql/subscription.type';
import { CreateSubscriptionInput } from '@application/dtos/create-subscription.dto';
import { UpdateSubscriptionInput } from '@application/dtos/update-subscription.dto';
import { GetSubscription } from '@application/use-cases/get-subscription.use-case';
import { CreateSubscription } from '@application/use-cases/create-subscription.use-case';
import { UpdateSubscription } from '@application/use-cases/update-subscription.use-case';
import { withSpan } from '@lib/tracing';
import { WinstonLogger } from '@logger/winston.logger';

@Resolver(() => SubscriptionType)
export class SubscriptionResolver {
  constructor(
    private readonly getSubscriptionUseCase: GetSubscription,
    private readonly createSubscriptionUseCase: CreateSubscription,
    private readonly updateSubscriptionUseCase: UpdateSubscription,
    private readonly logger: WinstonLogger,
  ) {}

  @Query(() => SubscriptionType)
  subscription(@Args('id', { type: () => ID }) id: string) {
    return this.trace(`findById id=${id}`, 'subscription.query', () =>
      this.getSubscriptionUseCase.execute(id),
    );
  }

  @Mutation(() => SubscriptionType)
  createSubscription(@Args('input') input: CreateSubscriptionInput) {
    return this.trace('createSubscription', 'subscription.create', () =>
      this.createSubscriptionUseCase.execute(input),
    );
  }

  @Mutation(() => SubscriptionType)
  updateSubscription(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSubscriptionInput,
  ) {
    return this.trace(
      `updateSubscription id=${id}`,
      'subscription.update',
      () => this.updateSubscriptionUseCase.execute(id, input),
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
