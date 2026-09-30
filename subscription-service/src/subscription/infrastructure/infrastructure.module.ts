import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';
import { SubscriptionEventOrmEntity } from '@infra/persistence/subscription-event.orm-entity';
import { SubscriptionSnapshotOrmEntity } from '@infra/persistence/subscription-snapshot.orm-entity';
import { SubscriptionEventSerializer } from '@infra/persistence/subscription-event.serializer';
import { EventStoreAdapter } from '@infra/persistence/event-store.adapter';
import { SubscriptionSnapshotStoreAdapter } from '@infra/persistence/subscription-snapshot-store.adapter';
import { SubscriptionProjectionAdapter } from '@infra/persistence/subscription-projection.adapter';
import { EventSourcedSubscriptionRepository } from '@infra/persistence/event-sourced-subscription.repository';
import { SubscriptionEventsProducer } from '@infra/messaging/subscription.event.producer';
import { SubscriptionAvroMapper } from '@infra/messaging/subscription-avro.mapper';
import { SubscriptionEventRelay } from '@infra/messaging/subscription-event.relay';
import { CircuitBreakerService } from '@infra/resilience/circuit-breaker.service';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import { SUBSCRIPTION_READ_MODEL } from '@application/ports/subscription-read-model.port';
import { SUBSCRIPTION_PROJECTION } from '@application/ports/subscription-projection.port';
import { EVENT_STORE } from '@application/ports/event-store.port';
import { SUBSCRIPTION_SNAPSHOT_STORE } from '@application/ports/subscription-snapshot-store.port';
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port';
import { LoggerModule } from '../../logger.module';

/**
 * Driven side of the hexagon: concrete adapters bound to the application's ports.
 * Exports the port tokens (not the classes) so the application layer depends only
 * on interfaces.
 *
 * The subscription aggregate is event-sourced: the command port resolves to the
 * event-sourced repository, reads resolve to the projection (read model), and the
 * outbox relay drains the event store to Kafka. The projection adapter serves both
 * the projection (write) and read-model (read) ports over the `subscriptions` table.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionOrmEntity,
      SubscriptionEventOrmEntity,
      SubscriptionSnapshotOrmEntity,
    ]),
    LoggerModule,
  ],
  providers: [
    // Persistence adapters + supporting services.
    SubscriptionEventSerializer,
    EventStoreAdapter,
    SubscriptionSnapshotStoreAdapter,
    SubscriptionProjectionAdapter,
    EventSourcedSubscriptionRepository,
    // Messaging: producer (transport), Avro mapper, and the outbox relay.
    SubscriptionEventsProducer,
    SubscriptionAvroMapper,
    SubscriptionEventRelay,
    CircuitBreakerService,
    // Port → adapter bindings.
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useExisting: EventSourcedSubscriptionRepository,
    },
    { provide: EVENT_STORE, useExisting: EventStoreAdapter },
    {
      provide: SUBSCRIPTION_SNAPSHOT_STORE,
      useExisting: SubscriptionSnapshotStoreAdapter,
    },
    {
      provide: SUBSCRIPTION_READ_MODEL,
      useExisting: SubscriptionProjectionAdapter,
    },
    {
      provide: SUBSCRIPTION_PROJECTION,
      useExisting: SubscriptionProjectionAdapter,
    },
    { provide: EVENT_PUBLISHER, useExisting: SubscriptionEventsProducer },
  ],
  exports: [
    SUBSCRIPTION_REPOSITORY,
    SUBSCRIPTION_READ_MODEL,
    EVENT_PUBLISHER,
    CircuitBreakerService,
  ],
})
export class InfrastructureModule {}
