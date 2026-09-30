import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Subscription } from '@domain/subscription';
import { SubscriptionStatus } from '@domain/subscription-status.enum';
import { SubscriptionProjectionPort } from '@application/ports/subscription-projection.port';
import { SubscriptionReadModelPort } from '@application/ports/subscription-read-model.port';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';
import { SubscriptionOrmMapper } from '@infra/persistence/subscription.orm-mapper';

/**
 * TypeORM adapter over the `subscriptions` projection table, serving both sides
 * of CQRS:
 *
 * - {@link SubscriptionProjectionPort} (write): the event-sourced repository
 *   upserts the materialised row, in its save transaction, from the aggregate.
 * - {@link SubscriptionReadModelPort} (read): the query use-cases read this row
 *   directly — no event replay.
 *
 * `project` is deliberately one-way (domain → row); it never maps back, so it
 * cannot reset the aggregate version the way a load-and-resave round-trip would.
 */
@Injectable()
export class SubscriptionProjectionAdapter
  implements SubscriptionProjectionPort, SubscriptionReadModelPort
{
  constructor(
    @InjectRepository(SubscriptionOrmEntity)
    private readonly repo: Repository<SubscriptionOrmEntity>,
  ) {}

  async project(
    subscription: Subscription,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(SubscriptionOrmEntity)
      : this.repo;
    // save() upserts by the id primary key: the aggregate always carries its id,
    // so an existing projection row is updated and a new one inserted.
    await repo.save(SubscriptionOrmMapper.toOrm(subscription));
  }

  async findById(id: string): Promise<Subscription | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? SubscriptionOrmMapper.toDomain(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<Subscription[]> {
    const rows = await this.repo.find({
      where: { userId, status: SubscriptionStatus.ACTIVE },
    });
    return rows.map((row) => SubscriptionOrmMapper.toDomain(row));
  }
}
