import { Module } from '@nestjs/common';
import { GetSubscription } from '@application/use-cases/get-subscription.use-case';
import { GetUserActiveSubscriptions } from '@application/use-cases/get-user-active-subscriptions.use-case';
import { CreateSubscription } from '@application/use-cases/create-subscription.use-case';
import { UpdateSubscription } from '@application/use-cases/update-subscription.use-case';
import { InfrastructureModule } from '@infra/infrastructure.module';

const USE_CASES = [
  GetSubscription,
  GetUserActiveSubscriptions,
  CreateSubscription,
  UpdateSubscription,
];

/**
 * The application core: one class per use-case, orchestrating the domain and the
 * driven ports. Command use-cases depend on the event-sourced repository port and
 * query use-cases on the read-model port; both tokens are provided by the
 * infrastructure module. Lifecycle events are emitted out of band by the outbox
 * relay, so the use-cases no longer publish directly.
 */
@Module({
  imports: [InfrastructureModule],
  providers: [...USE_CASES],
  exports: [...USE_CASES],
})
export class ApplicationModule {}
