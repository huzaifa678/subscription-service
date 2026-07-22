import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';
import { SubscriptionRepository } from '@infra/persistence/subscription.repository';
import { SubscriptionEventsProducer } from '@infra/messaging/subscription.event.producer';
import { CircuitBreakerService } from '@infra/resilience/circuit-breaker.service';
import { SUBSCRIPTION_REPOSITORY } from '@application/ports/subscription-repository.port';
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port';
import { LoggerModule } from '../../logger.module';

/**
 * Driven side of the hexagon: concrete adapters bound to the application's
 * ports. Exports the port tokens (not the classes) so the application layer
 * depends only on interfaces.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionOrmEntity]), LoggerModule],
  providers: [
    SubscriptionRepository,
    SubscriptionEventsProducer,
    CircuitBreakerService,
    { provide: SUBSCRIPTION_REPOSITORY, useExisting: SubscriptionRepository },
    { provide: EVENT_PUBLISHER, useExisting: SubscriptionEventsProducer },
  ],
  exports: [SUBSCRIPTION_REPOSITORY, EVENT_PUBLISHER, CircuitBreakerService],
})
export class InfrastructureModule {}
