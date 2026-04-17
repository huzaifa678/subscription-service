import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SubscriptionEntity } from '@model/entities/subscription.entity';
import { SubscriptionStatus } from '@model/domain/subscription-status.enum';
import { WinstonLogger } from '@logger/winston.logger';

@Injectable()
export class SubscriptionRepository implements OnApplicationShutdown {
  constructor(
    private readonly logger: WinstonLogger,
    @InjectRepository(SubscriptionEntity)
    private readonly repo: Repository<SubscriptionEntity>,

    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string) {
    this.logger.log(`subscription-repo: findById id=${id}`);
    const result = await this.repo.findOne({ where: { id } });
    if (result) {
      this.logger.debug(`subscription-repo: findById found id=${id}`);
    } else {
      this.logger.warn(`subscription-repo: findById not found id=${id}`);
    }
    return result;
  }

  async findActiveByUserId(userId: string) {
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
    return result;
  }

  async createAndSave(subscription: SubscriptionEntity) {
    this.logger.log(
      `subscription-repo: createAndSave subscriptionId=${subscription.id}`,
    );
    const saved = await this.repo.save(subscription);
    this.logger.log(
      `subscription-repo: createAndSave completed subscriptionId=${saved.id}`,
    );
    return saved;
  }

  async update(id: string, updateData: Partial<SubscriptionEntity>) {
    this.logger.log(`subscription-repo: update id=${id}`);
    const updated = await this.repo.save({ id, ...updateData });
    this.logger.log(`subscription-repo: update completed id=${id}`);
    return updated;
  }

  async onApplicationShutdown(signal: string) {
    this.logger.log(`Shutdown signal received: ${signal}`);

    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.logger.log('TypeORM DataSource closed gracefully');
    }
  }
}
