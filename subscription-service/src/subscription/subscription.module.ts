import { Module } from '@nestjs/common';
import { InterfaceModule } from '@interface/interface.module';

/**
 * Composition root for the subscription bounded context.
 *
 * Wires the hexagon together: InterfaceModule (driving adapters) →
 * ApplicationModule (use-cases) → InfrastructureModule (driven adapters).
 * AppModule imports only this module to mount the whole context.
 */
@Module({
  imports: [InterfaceModule],
})
export class SubscriptionModule {}
