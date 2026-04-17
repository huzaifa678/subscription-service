import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionEntity } from '@model/entities/subscription.entity';
import { SubscriptionService } from '@service/subscription.service';
import { SubscriptionRepository } from '@repository/subscription.repository';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [SubscriptionEntity],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([SubscriptionEntity]),
  ],
  providers: [SubscriptionService, SubscriptionRepository],
  exports: [SubscriptionService],
})
export class SubscriptionTestModule {}
