import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionGrpcController } from '@interface/grpc/subscription.controller.grpc';
import { GetSubscription } from '@application/use-cases/get-subscription.use-case';
import { GetUserActiveSubscriptions } from '@application/use-cases/get-user-active-subscriptions.use-case';
import { WinstonLogger } from '@logger/winston.logger';
import { create } from '@bufbuild/protobuf';
import * as subscription_pb from '@pb/subscription/v1/subscription_pb';
import { mockLogger } from './mock-logger';

describe('SubscriptionGrpcController', () => {
  let controller: SubscriptionGrpcController;

  const mockGet = { execute: jest.fn() };
  const mockGetActive = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionGrpcController],
      providers: [
        { provide: GetSubscription, useValue: mockGet },
        { provide: GetUserActiveSubscriptions, useValue: mockGetActive },
        { provide: WinstonLogger, useValue: mockLogger },
      ],
    }).compile();

    controller = module.get(SubscriptionGrpcController);
  });

  it('should map subscription correctly', async () => {
    const now = new Date();

    mockGet.execute.mockResolvedValue({
      id: '1',
      userId: 'u1',
      planId: 'p1',
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: now,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    const result = await controller.getSubscription(
      create(subscription_pb.GetSubscriptionRequestSchema, {
        subscriptionId: '1',
      }),
    );

    expect(result.id).toBe('1');
    expect(result.currentPeriodStart!.seconds).toBe(
      BigInt(Math.floor(now.getTime() / 1000)),
    );
  });
});
