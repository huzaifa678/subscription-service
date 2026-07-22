import { Subscription } from '@domain/subscription';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';

/**
 * Translates between the persistence model ({@link SubscriptionOrmEntity}) and
 * the domain model ({@link Subscription}), keeping TypeORM out of the core.
 */
export class SubscriptionOrmMapper {
  static toDomain(row: SubscriptionOrmEntity): Subscription {
    return Subscription.fromPersistence({
      id: row.id,
      userId: row.userId,
      planId: row.planId,
      status: row.status,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toOrm(subscription: Subscription): SubscriptionOrmEntity {
    const orm = new SubscriptionOrmEntity();
    Object.assign(orm, subscription.toProps());
    return orm;
  }
}
