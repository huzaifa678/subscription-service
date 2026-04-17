import { SubscriptionStatus } from '../domain/subscription-status.enum';

export class SubscriptionResponseDto {
  id!: string;
  userId!: string;
  planId!: string;
  status!: SubscriptionStatus;

  currentPeriodStart!: Date;
  currentPeriodEnd!: Date;

  cancelAtPeriodEnd!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}
