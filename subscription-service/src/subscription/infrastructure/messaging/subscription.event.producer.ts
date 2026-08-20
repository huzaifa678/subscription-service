import 'dotenv/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import * as fs from 'fs';
import * as path from 'path';
import { WinstonLogger } from '@logger/winston.logger';
import {
  EventPublisherPort,
  SubscriptionEvent,
  SubscriptionEventTopic,
} from '@application/ports/event-publisher.port';

@Injectable()
export class SubscriptionEventsProducer
  implements EventPublisherPort, OnModuleInit
{
  private kafkaProducer!: Producer;
  private registry!: SchemaRegistry;
  private schemaIds: Record<string, number> = {};

  constructor(private readonly logger: WinstonLogger) {}

  async onModuleInit() {
    this.logger.log('subscription-event-producer: onModuleInit starting');
    const kafka = new Kafka({
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      clientId: process.env.KAFKA_CLIENT_ID || 'subscription-service',
      retry: {
        retries: Number(process.env.KAFKA_PRODUCER_RETRIES ?? 5),
        initialRetryTime: 300,
      },
    });
    this.kafkaProducer = kafka.producer();
    await this.kafkaProducer.connect();

    this.registry = new SchemaRegistry({
      host: process.env.SCHEMA_REGISTRY_URL || 'http://localhost:9094',
    });

    await this.registerSchema(
      'subscription.created',
      '../../../schemas/subscription-created.avsc',
    );
    await this.registerSchema(
      'subscription.updated',
      '../../../schemas/subscription-updated.avsc',
    );
    this.logger.log('subscription-event-producer: onModuleInit completed');
  }

  private async registerSchema(topic: string, filePath: string) {
    this.logger.log(
      `subscription-event-producer: registerSchema topic=${topic}`,
    );
    const schemaPath = path.resolve(
      __dirname,
      '../../../schemas',
      path.basename(filePath),
    );

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    const subject = `${topic}-value`;
    try {
      const { id } = await this.registry.register(
        {
          type: SchemaType.AVRO,
          schema: schemaContent,
        },
        { subject },
      );

      this.schemaIds[topic] = id;
      this.logger.log(
        `subscription-event-producer: registerSchema completed topic=${topic} id=${id}`,
      );
      return;
    } catch (e: unknown) {
      const statusCode =
        typeof e === 'object' && e !== null && 'status' in e
          ? (e as { status?: number }).status
          : undefined;
      if (statusCode === 400) {
        const { id } = await this.registry.register(
          {
            type: SchemaType.AVRO,
            schema: schemaContent,
          },
          { subject },
        );

        this.schemaIds[topic] = id;
        this.logger.log(
          `subscription-event-producer: registerSchema already existed topic=${topic} id=${id}`,
        );
        return;
      }
      this.logger.error(
        `subscription-event-producer: registerSchema failed topic=${topic}`,
        e,
      );
      throw e;
    }
  }

  async publishEvent(
    topic: SubscriptionEventTopic,
    event: SubscriptionEvent,
  ): Promise<void> {
    this.logger.log(
      `subscription-event-producer: publishEvent topic=${topic} subscriptionId=${event?.subscriptionId}`,
    );
    const schemaId = this.schemaIds[topic];
    if (!schemaId) {
      const errorMessage = `Schema not registered for topic ${topic}`;
      this.logger.error(
        'subscription-event-producer: publishEvent failed',
        errorMessage,
      );
      throw new Error(errorMessage);
    }

    const encoded = await this.registry.encode(schemaId, event);
    try {
      await this.kafkaProducer.send({
        topic,
        messages: [{ key: event.subscriptionId, value: encoded }],
      });
    } catch (e: unknown) {
      // The send failed after kafkajs exhausted its retries; the message never left
      // the app so there is nothing to dead-letter. Surface it to Loki via the OTLP
      // logger for alerting/replay and rethrow for the caller to decide.
      this.logger.error(
        `subscription-event-producer: publishEvent failed topic=${topic} subscriptionId=${event?.subscriptionId}`,
        e,
      );
      throw e;
    }
    this.logger.log(
      `subscription-event-producer: publishEvent succeeded topic=${topic} subscriptionId=${event?.subscriptionId}`,
    );
  }
}
