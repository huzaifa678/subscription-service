import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubscriptionModule } from '../src/subscription/subscription.module';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';
import { SubscriptionRepository } from '@infra/persistence/subscription.repository';
import { SubscriptionEventsProducer } from '@infra/messaging/subscription.event.producer';
import { GetSubscription } from '@application/use-cases/get-subscription.use-case';
import { CreateSubscription } from '@application/use-cases/create-subscription.use-case';
import { UpdateSubscription } from '@application/use-cases/update-subscription.use-case';
import { GetUserActiveSubscriptions } from '@application/use-cases/get-user-active-subscriptions.use-case';
import { SubscriptionResolver } from '@interface/graphql/subscription.resolver';
import { SubscriptionGrpcController } from '@interface/grpc/subscription.controller.grpc';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port';
import { WinstonLogger } from '@logger/winston.logger';
import { mockLogger } from './mock-logger';

// Validates the real hexagonal module graph resolves end to end, stubbing only
// the driven adapters (DB + Kafka). compile() builds the DI graph without
// running lifecycle hooks, so nothing actually connects.
describe('Subscription module wiring', () => {
  it('resolves the full hexagon graph and binds ports to adapters', async () => {
    const repoStub = { findById: jest.fn() };
    const producerStub = { publishEvent: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [SubscriptionModule],
    })
      .overrideProvider(getRepositoryToken(SubscriptionOrmEntity))
      .useValue({})
      .overrideProvider(SubscriptionRepository)
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
    expect(moduleRef.get(CreateSubscription)).toBeInstanceOf(CreateSubscription);
    expect(moduleRef.get(UpdateSubscription)).toBeInstanceOf(UpdateSubscription);
    expect(moduleRef.get(SubscriptionResolver)).toBeInstanceOf(
      SubscriptionResolver,
    );
    expect(moduleRef.get(SubscriptionGrpcController)).toBeInstanceOf(
      SubscriptionGrpcController,
    );
    // Ports resolve to the concrete adapters bound in InfrastructureModule.
    expect(moduleRef.get(SUBSCRIPTION_REPOSITORY)).toBe(repoStub);
    expect(moduleRef.get(EVENT_PUBLISHER)).toBe(producerStub);
  });
});
