import { WinstonLogger } from '@logger/winston.logger';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionResolver } from '@interface/graphql/subscription.resolver';
import { GetSubscription } from '@application/use-cases/get-subscription.use-case';
import { CreateSubscription } from '@application/use-cases/create-subscription.use-case';
import { UpdateSubscription } from '@application/use-cases/update-subscription.use-case';
import { mockLogger } from './mock-logger';

describe('SubscriptionResolver', () => {
  let resolver: SubscriptionResolver;

  const mockGet = { execute: jest.fn() };
  const mockCreate = { execute: jest.fn() };
  const mockUpdate = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionResolver,
        { provide: GetSubscription, useValue: mockGet },
        { provide: CreateSubscription, useValue: mockCreate },
        { provide: UpdateSubscription, useValue: mockUpdate },
        { provide: WinstonLogger, useValue: mockLogger },
      ],
    }).compile();

    resolver = module.get(SubscriptionResolver);
  });

  it('should fetch subscription', async () => {
    const mockSub = { id: '1' };
    mockGet.execute.mockResolvedValue(mockSub);

    const result = await resolver.subscription('1');

    expect(mockGet.execute).toHaveBeenCalledWith('1');
    expect(result).toEqual(mockSub);
  });

  it('should create subscription', async () => {
    const input = { userId: 'u1', planId: 'p1' };
    mockCreate.execute.mockResolvedValue({ id: '1', ...input });

    const result = await resolver.createSubscription(input as any);

    expect(mockCreate.execute).toHaveBeenCalledWith(input);
    expect(result.id).toBe('1');
  });

  it('should update subscription', async () => {
    const input = { status: 'ACTIVE' };
    mockUpdate.execute.mockResolvedValue({ id: '1', ...input });

    const result = await resolver.updateSubscription('1', input as any);

    expect(mockUpdate.execute).toHaveBeenCalledWith('1', input);
    expect(result.status).toBe('ACTIVE');
  });
});
