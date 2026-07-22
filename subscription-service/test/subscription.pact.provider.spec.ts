import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verifier } from '@pact-foundation/pact';
import * as path from 'path';
import { startPostgresContainer } from './utils/postgres-testcontainer';
import { SubscriptionOrmEntity } from '@infra/persistence/subscription.orm-entity';
import { SubscriptionStatus } from '@domain/subscription-status.enum';
import { SubscriptionModule } from '../src/subscription/subscription.module';

const GRPC_PORT = 50151;
const PROTO_PATH = '/Users/smartboy/proto/subscription/v1/subscription.proto';
const PROTO_INCLUDE_DIR = '/Users/smartboy/proto';

const SUB_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '9f1c2d3e-7a8b-4c5d-9e0f-123456789abc';

describe('Pact Provider Verification: subscription-service (gRPC)', () => {
  let app: INestApplication;
  let subscriptionRepo: Repository<SubscriptionOrmEntity>;

  beforeAll(async () => {
    const pg = await startPostgresContainer();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: pg.host,
          port: pg.port,
          username: pg.username,
          password: pg.password,
          database: pg.database,
          entities: [SubscriptionOrmEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([SubscriptionOrmEntity]),
        SubscriptionModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    app.connectMicroservice({
      transport: Transport.GRPC,
      options: {
        package: 'subscription.v1',
        protoPath: PROTO_PATH,
        url: `0.0.0.0:${GRPC_PORT}`,
        loader: { includeDirs: [PROTO_INCLUDE_DIR] },
      },
    });

    await app.startAllMicroservices();
    await app.init();

    subscriptionRepo = moduleRef.get(getRepositoryToken(SubscriptionOrmEntity));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('validates gRPC contract from billing-service', async () => {
    const verifier = new Verifier({
      provider: 'subscription-service',
      providerVersion: process.env.GIT_COMMIT || '0.0.0-local',
      pactUrls: [
        path.resolve(
          __dirname,
          '../pacts/billing-service-subscription-service.json',
        ),
      ],
      transports: [{ port: GRPC_PORT, protocol: 'grpc' }],
      logLevel: 'warn',
      stateHandlers: {
        [`subscription ${SUB_ID} exists and is ACTIVE`]: async () => {
          await subscriptionRepo.delete({ id: SUB_ID });
          await subscriptionRepo.save({
            id: SUB_ID,
            userId: USER_ID,
            planId: 'plan-basic',
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
            cancelAtPeriodEnd: false,
          });
        },
        [`user ${USER_ID} has one ACTIVE subscription`]: async () => {
          await subscriptionRepo.delete({ userId: USER_ID });
          await subscriptionRepo.save({
            id: SUB_ID,
            userId: USER_ID,
            planId: 'plan-basic',
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
            cancelAtPeriodEnd: false,
          });
        },
      },
    });

    await verifier.verifyProvider();
  }, 120_000);
});
