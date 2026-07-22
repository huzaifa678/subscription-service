import { create } from '@bufbuild/protobuf';
import * as subscription_pb from '@pb/subscription/v1/subscription_pb';
import { SubscriptionEntity } from '@model/entities/subscription.entity';

/** Converts a Date to a protobuf Timestamp-like `{ seconds, nanos }` value. */
const toTimestamp = (date: Date) => ({
  seconds: BigInt(Math.floor(date.getTime() / 1000)),
  nanos: 0,
});

/**
 * Maps domain entities to their generated protobuf messages, keeping gRPC
 * wire-format concerns out of the controller (Single Responsibility).
 */
export class SubscriptionProtoMapper {
  static toResponse(
    sub: SubscriptionEntity,
  ): subscription_pb.GetSubscriptionResponse {
    return create(subscription_pb.GetSubscriptionResponseSchema, {
      id: sub.id,
      userId: sub.userId,
      planId: sub.planId,
      status: sub.status,
      currentPeriodStart: toTimestamp(sub.currentPeriodStart),
      currentPeriodEnd: toTimestamp(sub.currentPeriodEnd),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      createdAt: toTimestamp(sub.createdAt),
      updatedAt: toTimestamp(sub.updatedAt),
    });
  }
}
