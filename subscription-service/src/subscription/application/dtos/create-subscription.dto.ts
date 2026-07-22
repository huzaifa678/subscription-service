import { InputType, Field, ID } from '@nestjs/graphql';
import { IsUUID, IsString, IsOptional } from 'class-validator';

@InputType()
export class CreateSubscriptionInput {
  @Field(() => ID)
  @IsUUID()
  userId!: string;

  @Field()
  @IsString()
  planId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  billingCustomerId?: string;
}
