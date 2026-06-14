import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SubscriptionService } from '@service/subscription.service';
import * as subscription_pb from '@pb/subscription/v1/subscription_pb';
import { create } from '@bufbuild/protobuf';
import { withSpan } from '@lib/tracing';
import { SubscriptionProtoMapper } from '@mapper/subscription.proto-mapper';
import { WinstonLogger } from '@logger/winston.logger';

@Controller()
export class SubscriptionGrpcController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly logger: WinstonLogger,
  ) {}

  @GrpcMethod('SubscriptionService', 'GetSubscription')
  async getSubscription(
    data: subscription_pb.GetSubscriptionRequest,
  ): Promise<subscription_pb.GetSubscriptionResponse> {
    this.logger.log(
      `grpc-controller: GetSubscription request subscriptionId=${data.subscriptionId}`,
    );

    try {
      return await withSpan('grpc.GetSubscription', async () => {
        const sub = await this.subscriptionService.findById(
          data.subscriptionId,
        );

        if (!sub) {
          this.logger.warn(
            `grpc-controller: GetSubscription not found subscriptionId=${data.subscriptionId}`,
          );
          throw new Error(`Subscription ${data.subscriptionId} not found`);
        }

        this.logger.log(
          `grpc-controller: GetSubscription found subscriptionId=${data.subscriptionId}`,
        );

        return SubscriptionProtoMapper.toResponse(sub);
      });
    } catch (err) {
      this.logger.error(
        `grpc-controller: GetSubscription failed subscriptionId=${data.subscriptionId}`,
        err,
      );
      throw err;
    }
  }

  @GrpcMethod('SubscriptionService', 'GetUserActiveSubscriptions')
  async getUserActiveSubscriptions(
    data: subscription_pb.GetUserActiveSubscriptionsRequest,
  ): Promise<subscription_pb.GetUserActiveSubscriptionsResponse> {
    this.logger.log(
      `grpc-controller: GetUserActiveSubscriptions request userId=${data.userId}`,
    );

    try {
      const subs = await withSpan('grpc.GetUserActiveSubscriptions', () =>
        this.subscriptionService.findActiveByUserId(data.userId),
      );

      this.logger.log(
        `grpc-controller: GetUserActiveSubscriptions found ${subs.length} subscriptions for userId=${data.userId}`,
      );

      return create(subscription_pb.GetUserActiveSubscriptionsResponseSchema, {
        subscriptions: subs.map((sub) =>
          SubscriptionProtoMapper.toResponse(sub),
        ),
      });
    } catch (err) {
      this.logger.error(
        `grpc-controller: GetUserActiveSubscriptions failed userId=${data.userId}`,
        err,
      );
      throw err;
    }
  }
}
