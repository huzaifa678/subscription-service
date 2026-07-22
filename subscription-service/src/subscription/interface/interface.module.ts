import { Module } from '@nestjs/common';
import { SubscriptionResolver } from '@interface/graphql/subscription.resolver';
import { SubscriptionGrpcController } from '@interface/grpc/subscription.controller.grpc';
import { ApplicationModule } from '@application/application.module';
import { LoggerModule } from '../../logger.module';

/**
 * Driving side of the hexagon: adapters that invoke the application core.
 * The GraphQL resolver and gRPC controller live here; each maps its transport
 * shape to/from the domain and delegates to {@link ApplicationModule}.
 */
@Module({
  imports: [ApplicationModule, LoggerModule],
  controllers: [SubscriptionGrpcController],
  providers: [SubscriptionResolver],
})
export class InterfaceModule {}
