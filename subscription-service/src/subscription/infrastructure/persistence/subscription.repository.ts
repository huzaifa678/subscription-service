import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Subscription } from '@domain/subscription';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';
import { SubscriptionStatus } from '@domain/subscription-status.enum';
import { SubscriptionOrmMapper } from '@infra/persistence/subscription.orm-mapper';
import { SubscriptionRepositoryPort } from '@application/ports/subscription-repository.port';
import { WinstonLogger } from '@logger/winston.logger';

@Injectable()
export class SubscriptionRepository
  implements SubscriptionRepositoryPort, OnApplicationShutdown
{
  constructor(
    private readonly logger: WinstonLogger,
    @InjectRepository(SubscriptionOrmEntity)
    private readonly repo: Repository<SubscriptionOrmEntity>,

    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<Subscription | null> {
    this.logger.log(`subscription-repo: findById id=${id}`);
    const result = await this.repo.findOne({ where: { id } });
    if (result) {
      this.logger.debug(`subscription-repo: findById found id=${id}`);
    } else {
      this.logger.warn(`subscription-repo: findById not found id=${id}`);
    }
    return result ? SubscriptionOrmMapper.toDomain(result) : null;
  }

  async findActiveByUserId(userId: string): Promise<Subscription[]> {
    this.logger.log(`subscription-repo: findActiveByUserId userId=${userId}`);
    const result = await this.repo.find({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    this.logger.debug(
      `subscription-repo: findActiveByUserId returned ${result.length} rows`,
    );
    return result.map((row) => SubscriptionOrmMapper.toDomain(row));
  }

  async save(subscription: Subscription): Promise<Subscription> {
    this.logger.log(
      `subscription-repo: save subscriptionId=${subscription.id}`,
    );
    const saved = await this.repo.save(
      SubscriptionOrmMapper.toOrm(subscription),
    );
    this.logger.log(
      `subscription-repo: save completed subscriptionId=${saved.id}`,
    );
    return SubscriptionOrmMapper.toDomain(saved);
  }

  async onApplicationShutdown(signal: string) {
    this.logger.log(`Shutdown signal received: ${signal}`);

    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.logger.log('TypeORM DataSource closed gracefully');
    }
  }
}
