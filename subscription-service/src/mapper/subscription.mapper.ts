import { SubscriptionEntity } from '@model/entities/subscription.entity';
import { SubscriptionResponseDto } from '@model/dtos/subscription-response.dto';
import { CreateSubscriptionInput } from '@model/dtos/create-subscription.dto';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionStatus } from '@model/domain/subscription-status.enum';

/** Default billing period length: 30 days. */
const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export class SubscriptionMapper {
  static toResponse(entity: SubscriptionEntity): SubscriptionResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      planId: entity.planId,
      status: entity.status,
      currentPeriodStart: entity.currentPeriodStart,
      currentPeriodEnd: entity.currentPeriodEnd,
      cancelAtPeriodEnd: entity.cancelAtPeriodEnd,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toRequest(dto: CreateSubscriptionInput): SubscriptionEntity {
    const now = new Date();
    return {
      id: uuidv4(),
      userId: dto.userId,
      planId: dto.planId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + BILLING_PERIOD_MS),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    } as SubscriptionEntity;
  }

  /** Fields shared by every subscription lifecycle event. */
  private static toEventBase(entity: SubscriptionEntity) {
    return {
      subscriptionId: entity.id,
      userId: entity.userId,
      planId: entity.planId,
      status: entity.status,
      currentPeriodStart: entity.currentPeriodStart.toISOString(),
      currentPeriodEnd: entity.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: entity.cancelAtPeriodEnd,
    };
  }

  static toCreatedEvent(entity: SubscriptionEntity) {
    return {
      ...this.toEventBase(entity),
      createdAt: entity.createdAt.toISOString(),
    };
  }

  static toUpdatedEvent(entity: SubscriptionEntity) {
    return {
      ...this.toEventBase(entity),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
