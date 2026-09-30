import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StartedTestContainer } from 'testcontainers';
import { v4 as uuidv4 } from 'uuid';
import { CircuitBreakerService } from '@infra/resilience/circuit-breaker.service';
import { CreateSubscription } from '@application/use-cases/create-subscription.use-case';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';
import { SubscriptionEventOrmEntity } from '@infra/persistence/subscription-event.orm-entity';
import { SubscriptionSnapshotOrmEntity } from '@infra/persistence/subscription-snapshot.orm-entity';
import { SubscriptionEventSerializer } from '@infra/persistence/subscription-event.serializer';
import { EventStoreAdapter } from '@infra/persistence/event-store.adapter';
import { SubscriptionSnapshotStoreAdapter } from '@infra/persistence/subscription-snapshot-store.adapter';
import { SubscriptionProjectionAdapter } from '@infra/persistence/subscription-projection.adapter';
import { EventSourcedSubscriptionRepository } from '@infra/persistence/event-sourced-subscription.repository';
import { SubscriptionAvroMapper } from '@infra/messaging/subscription-avro.mapper';
import { SubscriptionEventRelay } from '@infra/messaging/subscription-event.relay';
import { startPostgresContainer } from '@test/utils/postgres-testcontainer';
import { WinstonLogger } from '@logger/winston.logger';
import { mockLogger } from './mock-logger';

/**
 * End-to-end integration of the event-sourced write path against a real Postgres:
 * creating a subscription appends a `subscription.created` event and projects the
 * read model in one transaction, and the outbox relay is what publishes to Kafka
 * (no direct publish from the use-case).
 */
describe('CreateSubscription + outbox relay (Integration)', () => {
  let module: TestingModule;
  let createUseCase: CreateSubscription;
  let relay: SubscriptionEventRelay;
  let eventRepo: Repository<SubscriptionEventOrmEntity>;
  let projectionRepo: Repository<SubscriptionOrmEntity>;
  let container: StartedTestContainer | undefined;

  // Breaker mock that just runs the wrapped action directly.
  const mockBreakerService = {
    create: (fn: any) => ({ fire: fn, shutdown: jest.fn() }),
  };
  const mockEventsProducer = { publishEvent: jest.fn() };

  beforeAll(async () => {
    const pg = await startPostgresContainer();
    container = pg.container;

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: pg.host,
          port: pg.port,
          username: pg.username,
          password: pg.password,
          database: pg.database,
          entities: [
            SubscriptionOrmEntity,
            SubscriptionEventOrmEntity,
            SubscriptionSnapshotOrmEntity,
          ],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([
          SubscriptionOrmEntity,
          SubscriptionEventOrmEntity,
          SubscriptionSnapshotOrmEntity,
        ]),
      ],
      providers: [
        SubscriptionEventSerializer,
        EventStoreAdapter,
        SubscriptionSnapshotStoreAdapter,
        SubscriptionProjectionAdapter,
        EventSourcedSubscriptionRepository,
        SubscriptionAvroMapper,
        SubscriptionEventRelay,
        CreateSubscription,
        { provide: CircuitBreakerService, useValue: mockBreakerService },
        { provide: WinstonLogger, useValue: mockLogger },
        {
          provide: SUBSCRIPTION_REPOSITORY,
          useExisting: EventSourcedSubscriptionRepository,
        },
        { provide: EVENT_PUBLISHER, useValue: mockEventsProducer },
      ],
    }).compile();

    createUseCase = module.get(CreateSubscription);
    relay = module.get(SubscriptionEventRelay);
    eventRepo = module.get(getRepositoryToken(SubscriptionEventOrmEntity));
    projectionRepo = module.get(getRepositoryToken(SubscriptionOrmEntity));
  });

  afterAll(async () => {
    await module?.close();
    await container?.stop();
  });

  it('appends a created event and projects the read model', async () => {
    const input = { userId: uuidv4(), planId: uuidv4() };

    const result = await createUseCase.execute(input as any);

    expect(result.id).toBeDefined();

    // Event store holds exactly one unpublished created event at sequence 1.
    const events = await eventRepo.find({
      where: { aggregateId: result.id },
      order: { sequence: 'ASC' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      aggregateType: 'subscription',
      eventType: 'subscription.created',
      sequence: 1,
      published: false,
    });

    // Projection row exists and mirrors the aggregate.
    const projected = await projectionRepo.findOne({
      where: { id: result.id },
    });
    expect(projected).not.toBeNull();
    expect(projected!.userId).toBe(input.userId);
    expect(projected!.version).toBe(1);
  });

  it('publishes the created event via the outbox relay and marks it published', async () => {
    mockEventsProducer.publishEvent.mockClear();

    await relay.relay();

    expect(mockEventsProducer.publishEvent).toHaveBeenCalledWith(
      'subscription.created',
      expect.objectContaining({
        subscriptionId: expect.any(String),
        userId: expect.any(String),
        planId: expect.any(String),
      }),
    );

    const unpublished = await eventRepo.count({ where: { published: false } });
    expect(unpublished).toBe(0);
  });
});
