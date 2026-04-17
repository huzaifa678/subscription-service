import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SubscriptionService } from '@service/subscription.service';
import {
  GetSubscriptionRequest,
  GetUserActiveSubscriptionsRequest,
  GetUserActiveSubscriptionsResponse,
  SubscriptionResponse,
} from '@pb/src/proto/subscription';
import { trace, context } from '@opentelemetry/api';
import { WinstonLogger } from '@logger/winston.logger';

const tracer = trace.getTracer('subscription-service');

@Controller()
export class SubscriptionGrpcController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly logger: WinstonLogger,
  ) {}

  @GrpcMethod('SubscriptionService', 'GetSubscription')
  async getSubscription(
    data: GetSubscriptionRequest,
  ): Promise<SubscriptionResponse> {
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

          return {
            id: sub.id,
            userId: sub.userId,
            planId: sub.planId,
            status: sub.status,
            currentPeriodStart: {
              seconds: Math.floor(sub.currentPeriodStart.getTime() / 1000),
              nanos: 0,
            },
            currentPeriodEnd: {
              seconds: Math.floor(sub.currentPeriodEnd.getTime() / 1000),
              nanos: 0,
            },
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            createdAt: {
              seconds: Math.floor(sub.createdAt.getTime() / 1000),
              nanos: 0,
            },
            updatedAt: {
              seconds: Math.floor(sub.updatedAt.getTime() / 1000),
              nanos: 0,
            },
          };
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
    data: GetUserActiveSubscriptionsRequest,
  ): Promise<GetUserActiveSubscriptionsResponse> {
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

      return {
        subscriptions: subs.map((sub) => ({
          id: sub.id,
          userId: sub.userId,
          planId: sub.planId,
          status: sub.status,
          currentPeriodStart: {
            seconds: Math.floor(sub.currentPeriodStart.getTime() / 1000),
            nanos: 0,
          },
          currentPeriodEnd: {
            seconds: Math.floor(sub.currentPeriodEnd.getTime() / 1000),
            nanos: 0,
          },
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          createdAt: {
            seconds: Math.floor(sub.createdAt.getTime() / 1000),
            nanos: 0,
          },
          updatedAt: {
            seconds: Math.floor(sub.updatedAt.getTime() / 1000),
            nanos: 0,
          },
        })),
      };
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
