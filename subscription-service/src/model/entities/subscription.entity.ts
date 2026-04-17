import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  ObjectType,
  Field,
  ID,
  registerEnumType,
  GraphQLISODateTime,
} from '@nestjs/graphql';
import { SubscriptionStatus } from '../domain/subscription-status.enum';

registerEnumType(SubscriptionStatus, { name: 'SubscriptionStatus' });

@ObjectType('Subscription')
@Entity({ name: 'subscriptions' })
@Index(['userId']) 
@Index(['status'])
@Index(['currentPeriodEnd']) 
@Index(['userId', 'status'])
export class SubscriptionEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field(() => ID)
  @Column('uuid')
  userId!: string;

  @Field()
  @Column('text')
  planId!: string;

  @Field(() => SubscriptionStatus)
  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Field(() => GraphQLISODateTime)
  @Column({ type: 'timestamptz' })
  currentPeriodStart!: Date;

  @Field(() => GraphQLISODateTime)
  @Column({ type: 'timestamptz' })
  currentPeriodEnd!: Date;

  @Field()
  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
