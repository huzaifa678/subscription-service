import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { Subscription } from '@domain/subscription';
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port';
import type { EventPublisherPort } from '@application/ports/event-publisher.port';
import { SubscriptionEventOrmEntity } from '@infra/persistence/subscription-event.orm-entity';
import { SubscriptionEventSerializer } from '@infra/persistence/subscription-event.serializer';
import { SubscriptionAvroMapper } from '@infra/messaging/subscription-avro.mapper';
import { WinstonLogger } from '@logger/winston.logger';

/** The `aggregate_type` discriminator for subscription events in the store. */
const AGGREGATE_TYPE = 'subscription';

/** Poll interval and batch size (env-overridable). */
const INTERVAL_MS = Number(
  process.env.SUBSCRIPTION_EVENT_RELAY_INTERVAL_MS ?? 1000,
);
const BATCH_SIZE = Number(process.env.SUBSCRIPTION_EVENT_RELAY_BATCH ?? 100);

/**
 * Transactional-outbox relay: publishes stored subscription events to Kafka.
 *
 * A lightweight `setInterval` loop (no scheduler dependency) polls the event
 * store for unpublished rows in append order, maps each to its Avro message, and
 * publishes it, marking a row published only after the broker acks — which
 * replaces the previous persist-then-publish dual write (create rethrew, update
 * *swallowed* publish failures, silently dropping events). Delivery is
 * at-least-once; consumers dedupe on the message key / event id.
 *
 * Because the two Kafka schemas carry full state, each event is mapped against
 * the aggregate state folded up to that event (not the current state), so a
 * message reflects the world as of when its event happened. Subscription streams
 * are short, so the per-event fold is cheap; a failed publish stops the batch and
 * the remaining rows are retried on the next tick.
 */
@Injectable()
export class SubscriptionEventRelay
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectRepository(SubscriptionEventOrmEntity)
    private readonly events: Repository<SubscriptionEventOrmEntity>,
    private readonly serializer: SubscriptionEventSerializer,
    private readonly mapper: SubscriptionAvroMapper,
    @Inject(EVENT_PUBLISHER)
    private readonly producer: EventPublisherPort,
    private readonly logger: WinstonLogger,
  ) {}

  onApplicationBootstrap() {
    if (process.env.SUBSCRIPTION_EVENT_RELAY_ENABLED === 'false') {
      this.logger.log('subscription-event-relay: disabled via env');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, INTERVAL_MS);
    this.logger.log(
      `subscription-event-relay: started (interval=${INTERVAL_MS}ms batch=${BATCH_SIZE})`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One poll cycle; guarded so cycles never overlap. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.relay();
    } catch (error) {
      this.logger.error('subscription-event-relay: relay cycle failed', error);
    } finally {
      this.running = false;
    }
  }

  /** Publish the next batch of unpublished events, in append order. */
  async relay(): Promise<void> {
    const rows = await this.events.find({
      where: { published: false },
      order: { globalSeq: 'ASC' },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) return;

    const publishedIds: string[] = [];
    try {
      for (const row of rows) {
        const state = await this.rebuildAsOf(row.aggregateId, row.sequence);
        const event = this.serializer.deserialize(row);
        const { topic, payload } = this.mapper.map(event, state);
        await this.producer.publishEvent(topic, payload);
        publishedIds.push(row.globalSeq);
      }
    } catch (error) {
      // Stop on first failure; already-published rows are marked below, the rest
      // are retried next tick (at-least-once).
      this.logger.error('subscription-event-relay: publish failed', error);
    } finally {
      if (publishedIds.length > 0) {
        await this.events.update(
          { globalSeq: In(publishedIds) },
          { published: true },
        );
      }
    }
  }

  /** Rebuild aggregate state by folding its events up to and including `sequence`. */
  private async rebuildAsOf(
    aggregateId: string,
    sequence: number,
  ): Promise<Subscription> {
    const rows = await this.events.find({
      where: {
        aggregateType: AGGREGATE_TYPE,
        aggregateId,
        sequence: LessThanOrEqual(sequence),
      },
      order: { sequence: 'ASC' },
    });
    return Subscription.replay(
      rows.map((row) => this.serializer.deserialize(row)),
    );
  }
}
