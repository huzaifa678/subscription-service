import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SubscriptionService } from '@service/subscription.service';
import * as subscription_pb from '@pb/subscription/v1/subscription_pb';
import { create } from '@bufbuild/protobuf';
import { trace, context } from '@opentelemetry/api';
import { WinstonLogger } from '@logger/winston.logger';

const tracer = trace.getTracer('subscription-service');

@Controller()
export class SubscriptionGrpcController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly logger: WinstonLogger,
  ) {}

  private mapToProto(sub: any): subscription_pb.GetSubscriptionResponse {
    return create(subscription_pb.GetSubscriptionResponseSchema, {
      id: sub.id,
      userId: sub.userId,
      planId: sub.planId,
      status: sub.status,
      currentPeriodStart: {
        seconds: BigInt(Math.floor(sub.currentPeriodStart.getTime() / 1000)),
        nanos: 0,
      },
      currentPeriodEnd: {
        seconds: BigInt(Math.floor(sub.currentPeriodEnd.getTime() / 1000)),
        nanos: 0,
      },
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      createdAt: {
        seconds: BigInt(Math.floor(sub.createdAt.getTime() / 1000)),
        nanos: 0,
      },
      updatedAt: {
        seconds: BigInt(Math.floor(sub.updatedAt.getTime() / 1000)),
        nanos: 0,
      },
    });
  }

  @GrpcMethod('SubscriptionService', 'GetSubscription')
  async getSubscription(
    data: subscription_pb.GetSubscriptionRequest,
  ): Promise<subscription_pb.GetSubscriptionResponse> {
    this.logger.log(
      `grpc-controller: GetSubscription request subscriptionId=${data.subscriptionId}`,
    );

    const span = tracer.startSpan('grpc.GetSubscription');

    try {
      return await context.with(
        trace.setSpan(context.active(), span),
        async () => {
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

          return this.mapToProto(sub); 
        },
      );
    } catch (err) {
      this.logger.error(
        `grpc-controller: GetSubscription failed subscriptionId=${data.subscriptionId}`,
        err,
      );

      span.setStatus({
        code: 2,
        message: err instanceof Error ? err.message : String(err),
      });

      throw err;
    } finally {
      span.end();
    }
  }

  @GrpcMethod('SubscriptionService', 'GetUserActiveSubscriptions')
  async getUserActiveSubscriptions(
    data: subscription_pb.GetUserActiveSubscriptionsRequest,
  ): Promise<subscription_pb.GetUserActiveSubscriptionsResponse> {
    this.logger.log(
      `grpc-controller: GetUserActiveSubscriptions request userId=${data.userId}`,
    );

    const span = tracer.startSpan('grpc.GetUserActiveSubscriptions');

    try {
      const subs = await context.with(
        trace.setSpan(context.active(), span),
        async () =>
          await this.subscriptionService.findActiveByUserId(data.userId),
      );

      this.logger.log(
        `grpc-controller: GetUserActiveSubscriptions found ${subs.length} subscriptions for userId=${data.userId}`,
      );

      return create(subscription_pb.GetUserActiveSubscriptionsResponseSchema, {
        subscriptions: subs.map((sub) => this.mapToProto(sub)), 
      });
    } catch (err) {
      this.logger.error(
        `grpc-controller: GetUserActiveSubscriptions failed userId=${data.userId}`,
        err,
      );

      span.setStatus({
        code: 2,
        message: err instanceof Error ? err.message : String(err),
      });

      throw err;
    } finally {
      span.end();
    }
  }
}
