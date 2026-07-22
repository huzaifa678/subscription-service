import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GetSubscription } from '@application/use-cases/get-subscription.use-case';
import { GetUserActiveSubscriptions } from '@application/use-cases/get-user-active-subscriptions.use-case';
import * as subscription_pb from '@pb/subscription/v1/subscription_pb';
import { create } from '@bufbuild/protobuf';
import { withSpan } from '@lib/tracing';
import { SubscriptionProtoMapper } from '@interface/grpc/subscription.proto-mapper';
import { WinstonLogger } from '@logger/winston.logger';

@Controller()
export class SubscriptionGrpcController {
  constructor(
    private readonly getSubscriptionUseCase: GetSubscription,
    private readonly getUserActiveSubscriptionsUseCase: GetUserActiveSubscriptions,
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
        const sub = await this.getSubscriptionUseCase.execute(
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
        this.getUserActiveSubscriptionsUseCase.execute(data.userId),
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
