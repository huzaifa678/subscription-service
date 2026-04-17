import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '@service/subscription.service';
import { CircuitBreakerService } from '@service/circuit-breaker.service';
import { SubscriptionEventsProducer } from '@events/subscription.event.producer';
import { startPostgresContainer } from '@test/utils/postgres-testcontainer';
import { StartedTestContainer } from 'testcontainers';
import { v4 as uuidv4 } from 'uuid';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionEntity } from '@model/entities/subscription.entity';
import { SubscriptionRepository } from '@repository/subscription.repository';
import { WinstonLogger } from '@logger/winston.logger';
import { mockLogger } from './mock-logger';

describe('SubscriptionService (Integration)', () => {
  let service: SubscriptionService;
  let container: StartedTestContainer | undefined;

  const mockBreakerService = {
    create: (fn: any) => ({
      fire: fn,
      shutdown: jest.fn(),
    }),
  };

  const mockEventsProducer = {
    publishEvent: jest.fn(),
  };

  beforeAll(async () => {
    const pg = await startPostgresContainer();
    container = pg.container;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: pg.host,
          port: pg.port,
          username: pg.username,
          password: pg.password,
          database: pg.database,
          entities: [SubscriptionEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([SubscriptionEntity]),
      ],
      providers: [
        SubscriptionService,
        SubscriptionRepository,
        { provide: CircuitBreakerService, useValue: mockBreakerService },
        { provide: SubscriptionEventsProducer, useValue: mockEventsProducer },
        { provide: WinstonLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  afterAll(async () => {
    await container?.stop();
  });

  it('should create subscription and publish event', async () => {
    const input = {
      userId: uuidv4(),
      planId: uuidv4(),
    };

    const result = await service.create(input as any);

    expect(result.id).toBeDefined();
    expect(mockEventsProducer.publishEvent).toHaveBeenCalledWith(
      'subscription.created',
      expect.objectContaining({
        userId: input.userId,
        planId: input.planId,
      }),
    );
  });
});
