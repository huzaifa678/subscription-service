import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionResolver } from '@resolvers/subscription.resolver';
import { SubscriptionService } from '@service/subscription.service';
import { CircuitBreakerService } from '@service/circuit-breaker.service';
import { SubscriptionEntity } from '@model/entities/subscription.entity';
import { SubscriptionRepository } from './repository/subscription.repository';
import { SubscriptionEventsProducer } from './events/subscription.event.producer';
import { SubscriptionGrpcController } from './controller/subscription.controller.grpc';
import { WinstonLogger } from '@logger/winston.logger';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionEntity])],
  controllers: [SubscriptionGrpcController],
  providers: [
    SubscriptionService,
    SubscriptionResolver,
    CircuitBreakerService,
    SubscriptionRepository,
    SubscriptionEventsProducer,
    WinstonLogger,
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
