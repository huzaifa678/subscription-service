import 'dotenv/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import * as fs from 'fs';
import * as path from 'path';
import { WinstonLogger } from '@logger/winston.logger';

type SubscriptionEvent = { subscriptionId: string; [key: string]: unknown };

@Injectable()
export class SubscriptionEventsProducer implements OnModuleInit {
  private kafkaProducer!: Producer;
  private registry!: SchemaRegistry;
  private schemaIds: Record<string, number> = {};

  constructor(private readonly logger: WinstonLogger) {}

  async onModuleInit() {
    this.logger.log('subscription-event-producer: onModuleInit starting');
    const kafka = new Kafka({
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      clientId: process.env.KAFKA_CLIENT_ID || 'subscription-service',
    });
    this.kafkaProducer = kafka.producer();
    await this.kafkaProducer.connect();

    this.registry = new SchemaRegistry({
      host: process.env.SCHEMA_REGISTRY_URL || 'http://localhost:9094',
    });

    await this.registerSchema(
      'subscription.created',
      '../schemas/subscription-created.avsc',
    );
    await this.registerSchema(
      'subscription.updated',
      '../schemas/subscription-updated.avsc',
    );
    this.logger.log('subscription-event-producer: onModuleInit completed');
  }

  private async registerSchema(topic: string, filePath: string) {
    this.logger.log(
      `subscription-event-producer: registerSchema topic=${topic}`,
    );
    const schemaPath = path.resolve(
      __dirname,
      '../schemas',
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
      const statusCode = typeof e === 'object' && e !== null && 'status' in e ? (e as { status?: number }).status : undefined;
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
    topic: 'subscription.created' | 'subscription.updated',
    event: SubscriptionEvent,
  ) {
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
    await this.kafkaProducer.send({
      topic,
      messages: [{ key: event.subscriptionId, value: encoded }],
    });
    this.logger.log(
      `subscription-event-producer: publishEvent succeeded topic=${topic} subscriptionId=${event?.subscriptionId}`,
    );
  }
}
