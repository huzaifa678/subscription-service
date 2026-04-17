import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { SubscriptionStatus } from '../domain/subscription-status.enum';

@InputType()
export class UpdateSubscriptionInput {
  @Field(() => SubscriptionStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;
}
