import {
  ObjectType,
  Field,
  ID,
  registerEnumType,
  GraphQLISODateTime,
} from '@nestjs/graphql';
import { SubscriptionStatus } from '@domain/subscription-status.enum';

registerEnumType(SubscriptionStatus, { name: 'SubscriptionStatus' });

/**
 * Driving-side GraphQL view of a subscription — the schema type exposed to
 * API clients. Field-for-field compatible with the domain {@link Subscription}
 * so resolvers can return domain objects directly.
 */
@ObjectType('Subscription')
export class SubscriptionType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  userId!: string;

  @Field()
  planId!: string;

  @Field(() => SubscriptionStatus)
  status!: SubscriptionStatus;

  @Field(() => GraphQLISODateTime)
  currentPeriodStart!: Date;

  @Field(() => GraphQLISODateTime)
  currentPeriodEnd!: Date;

  @Field()
  cancelAtPeriodEnd!: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
