import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { SubscriptionModule } from '../src/subscription/subscription.module';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';
import { SubscriptionEventOrmEntity } from '@infra/persistence/subscription-event.orm-entity';
import { SubscriptionSnapshotOrmEntity } from '@infra/persistence/subscription-snapshot.orm-entity';
import { EventSourcedSubscriptionRepository } from '@infra/persistence/event-sourced-subscription.repository';
import { SubscriptionProjectionAdapter } from '@infra/persistence/subscription-projection.adapter';
import { SubscriptionEventsProducer } from '@infra/messaging/subscription.event.producer';
import { GetSubscription } from '@application/use-cases/get-subscription.use-case';
import { CreateSubscription } from '@application/use-cases/create-subscription.use-case';
import { UpdateSubscription } from '@application/use-cases/update-subscription.use-case';
import { GetUserActiveSubscriptions } from '@application/use-cases/get-user-active-subscriptions.use-case';
import { SubscriptionResolver } from '@interface/graphql/subscription.resolver';
import { SubscriptionGrpcController } from '@interface/grpc/subscription.controller.grpc';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import { SUBSCRIPTION_READ_MODEL } from '@application/ports/subscription-read-model.port';
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port';
import { WinstonLogger } from '@logger/winston.logger';
import { mockLogger } from './mock-logger';

// Validates the real hexagonal module graph resolves end to end, stubbing only
// the driven adapters (DB + Kafka). compile() builds the DI graph without running
// lifecycle hooks, so the outbox relay's interval never starts.
describe('Subscription module wiring', () => {
  it('resolves the full hexagon graph and binds ports to adapters', async () => {
    const repoStub = { findById: jest.fn(), save: jest.fn() };
    const producerStub = { publishEvent: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [SubscriptionModule],
    })
      // Stub every TypeORM repository + the DataSource so nothing connects.
      .overrideProvider(getRepositoryToken(SubscriptionOrmEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(SubscriptionEventOrmEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(SubscriptionSnapshotOrmEntity))
      .useValue({})
      .overrideProvider(getDataSourceToken())
      .useValue({})
      // The event-sourced repository and Kafka producer are the driven adapters.
      .overrideProvider(EventSourcedSubscriptionRepository)
      .useValue(repoStub)
      .overrideProvider(SubscriptionEventsProducer)
      .useValue(producerStub)
      .overrideProvider(WinstonLogger)
      .useValue(mockLogger)
      .compile();

    // Every use-case resolves.
    expect(moduleRef.get(GetSubscription)).toBeInstanceOf(GetSubscription);
    expect(moduleRef.get(GetUserActiveSubscriptions)).toBeInstanceOf(
      GetUserActiveSubscriptions,
    );
    expect(moduleRef.get(CreateSubscription)).toBeInstanceOf(
      CreateSubscription,
    );
    expect(moduleRef.get(UpdateSubscription)).toBeInstanceOf(
      UpdateSubscription,
    );
    expect(moduleRef.get(SubscriptionResolver)).toBeInstanceOf(
      SubscriptionResolver,
    );
    expect(moduleRef.get(SubscriptionGrpcController)).toBeInstanceOf(
      SubscriptionGrpcController,
    );

    // Command port → event-sourced repository; read port → projection adapter;
    // publisher port → Kafka producer.
    expect(moduleRef.get(SUBSCRIPTION_REPOSITORY)).toBe(repoStub);
    expect(moduleRef.get(SUBSCRIPTION_READ_MODEL)).toBeInstanceOf(
      SubscriptionProjectionAdapter,
    );
    expect(moduleRef.get(EVENT_PUBLISHER)).toBe(producerStub);
  });
});
