import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from '@infra/resilience/circuit-breaker.service';
import { SubscriptionEventPublisher } from '@application/subscription-event.publisher';
import { CreateSubscription } from '@application/use-cases/create-subscription.use-case';
import { startPostgresContainer } from '@test/utils/postgres-testcontainer';
import { StartedTestContainer } from 'testcontainers';
import { v4 as uuidv4 } from 'uuid';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';
import { SubscriptionRepository } from '@infra/persistence/subscription.repository';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port';
import { WinstonLogger } from '@logger/winston.logger';
import { mockLogger } from './mock-logger';

describe('CreateSubscription (Integration)', () => {
  let createUseCase: CreateSubscription;
  let container: StartedTestContainer | undefined;

  // Breaker mock that just runs the wrapped action directly.
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
          entities: [SubscriptionOrmEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([SubscriptionOrmEntity]),
      ],
      providers: [
        CreateSubscription,
        SubscriptionEventPublisher,
        SubscriptionRepository,
        { provide: CircuitBreakerService, useValue: mockBreakerService },
        { provide: WinstonLogger, useValue: mockLogger },
        // Bind driven ports: repository -> real adapter, publisher -> mock.
        {
          provide: SUBSCRIPTION_REPOSITORY,
          useExisting: SubscriptionRepository,
        },
        { provide: EVENT_PUBLISHER, useValue: mockEventsProducer },
      ],
    }).compile();

    createUseCase = module.get(CreateSubscription);
  });

  afterAll(async () => {
    await container?.stop();
  });

  it('should create subscription and publish event', async () => {
    const input = {
      userId: uuidv4(),
      planId: uuidv4(),
    };

    const result = await createUseCase.execute(input as any);

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
