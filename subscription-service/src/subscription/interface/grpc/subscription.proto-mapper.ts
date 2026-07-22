import { create } from '@bufbuild/protobuf';
import * as subscription_pb from '@pb/subscription/v1/subscription_pb';
import { Subscription } from '@domain/subscription';

/** Converts a Date to a protobuf Timestamp-like `{ seconds, nanos }` value. */
const toTimestamp = (date: Date) => ({
  seconds: BigInt(Math.floor(date.getTime() / 1000)),
  nanos: 0,
});

/**
 * Maps a domain subscription to its generated protobuf message, keeping gRPC
 * wire-format concerns out of the controller (Single Responsibility).
 */
export class SubscriptionProtoMapper {
  static toResponse(
    sub: Subscription,
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
