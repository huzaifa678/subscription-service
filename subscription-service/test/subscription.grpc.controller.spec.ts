import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionGrpcController } from '@controller/subscription.controller.grpc';
import { SubscriptionService } from '@service/subscription.service';
import { WinstonLogger } from '@logger/winston.logger';
import { mockLogger } from './mock-logger';

describe('SubscriptionGrpcController', () => {
  let controller: SubscriptionGrpcController;

  const mockService = {
    findById: jest.fn(),
    findActiveByUserId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionGrpcController],
      providers: [{ provide: SubscriptionService, useValue: mockService },
        { provide: WinstonLogger, useValue: mockLogger },
      ],
    }).compile();

    controller = module.get(SubscriptionGrpcController);
  });

  it('should map subscription correctly', async () => {
    const now = new Date();

    mockService.findById.mockResolvedValue({
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

    const result = await controller.getSubscription({
      subscriptionId: '1',
    });

    expect(result.id).toBe('1');
    expect(result.currentPeriodStart!.seconds).toBe(
      Math.floor(now.getTime() / 1000),
    );
  });
});
