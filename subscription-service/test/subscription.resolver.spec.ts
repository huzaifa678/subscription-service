import { WinstonLogger } from '@logger/winston.logger';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionResolver } from '@resolvers/subscription.resolver';
import { SubscriptionService } from '@service/subscription.service';
import { mockLogger } from './mock-logger';

describe('SubscriptionResolver', () => {
  let resolver: SubscriptionResolver;
  let service: SubscriptionService;

  const mockService = {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionResolver,
        { provide: SubscriptionService, useValue: mockService },
        { provide: WinstonLogger, useValue: mockLogger },
      ],
    }).compile();

    resolver = module.get(SubscriptionResolver);
    service = module.get(SubscriptionService);
  });

  it('should fetch subscription', async () => {
    const mockSub = { id: '1' };
    mockService.findById.mockResolvedValue(mockSub);

    const result = await resolver.subscription('1');

    expect(service.findById).toHaveBeenCalledWith('1');
    expect(result).toEqual(mockSub);
  });

  it('should create subscription', async () => {
    const input = { userId: 'u1', planId: 'p1' };
    mockService.create.mockResolvedValue({ id: '1', ...input });

    const result = await resolver.createSubscription(input as any);

    expect(service.create).toHaveBeenCalledWith(input);
    expect(result.id).toBe('1');
  });

  it('should update subscription', async () => {
    const input = { status: 'ACTIVE' };
    mockService.update.mockResolvedValue({ id: '1', ...input });

    const result = await resolver.updateSubscription('1', input as any);

    expect(service.update).toHaveBeenCalledWith('1', input);
    expect(result.status).toBe('ACTIVE');
  });
});
