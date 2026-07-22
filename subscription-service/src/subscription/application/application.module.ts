import { Module } from '@nestjs/common';
import { GetSubscription } from '@application/use-cases/get-subscription.use-case';
import { GetUserActiveSubscriptions } from '@application/use-cases/get-user-active-subscriptions.use-case';
import { CreateSubscription } from '@application/use-cases/create-subscription.use-case';
import { UpdateSubscription } from '@application/use-cases/update-subscription.use-case';
import { SubscriptionEventPublisher } from '@application/subscription-event.publisher';
import { InfrastructureModule } from '@infra/infrastructure.module';

const USE_CASES = [
  GetSubscription,
  GetUserActiveSubscriptions,
  CreateSubscription,
  UpdateSubscription,
];

/**
 * The application core: one class per use-case, orchestrating the domain and
 * the driven ports. Depends on the infrastructure module only for the port
 * tokens it exports — never on concrete adapter classes.
 */
@Module({
  imports: [InfrastructureModule],
  providers: [...USE_CASES, SubscriptionEventPublisher],
  exports: [...USE_CASES],
})
export class ApplicationModule {}
