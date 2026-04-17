import { Module } from '@nestjs/common';
import { SubscriptionEventsProducer } from './events/subscription.event.producer';
import { LoggerModule } from './logger.module';

@Module({
  imports: [LoggerModule],
  providers: [SubscriptionEventsProducer],
  exports: [SubscriptionEventsProducer],
})
export class KafkaModule {}
