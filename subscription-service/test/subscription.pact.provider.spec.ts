import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PactVerifierService, PactProviderModule } from 'nestjs-pact';
import * as path from 'path';
import { startPostgresContainer } from './utils/postgres-testcontainer';
import { SubscriptionEntity } from '../src/model/entities/subscription.entity';
import { SubscriptionStatus } from '../src/model/domain/subscription-status.enum';

describe('Pact Provider Verification: subscription-service (gRPC)', () => {
  let app: INestApplication;
  let verifier: PactVerifierService;
  let subscriptionRepo: Repository<SubscriptionEntity>;

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
          entities: [SubscriptionEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([SubscriptionEntity]),

        PactProviderModule.register({
          provider: 'subscription-service',
          pactUrls: [
            path.resolve(
              __dirname,
              '../pacts/billing-service-subscription-service.json',
            ),
          ],

          logLevel: 'warn',

          grpc: {
            protoPath: path.resolve(
              __dirname,
              '../proto/subscription.proto',
            ),
            package: 'subscription',
            service: 'SubscriptionService',
          },

          stateHandlers: {
            'subscription sub-123 exists and is ACTIVE': async () => {
              await subscriptionRepo.save({
                id: 'sub-123',
                userId: 'user-456',
                planId: 'plan-basic',
                status: SubscriptionStatus.ACTIVE,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(),
                cancelAtPeriodEnd: false,
              });
            },
          },
        }),
      ],

      providers: [
        SubscriptionService,
        SubscriptionRepository,
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    app.connectMicroservice({
      transport: Transport.GRPC,
      options: {
        package: 'subscription',
        protoPath: path.join(__dirname, '../proto/subscription.proto'),
      },
    });

    await app.startAllMicroservices();
    await app.init();

    subscriptionRepo = moduleRef.get(
      getRepositoryToken(SubscriptionEntity),
    );

    verifier = moduleRef.get(PactVerifierService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('validates gRPC contract from billing-service', async () => {
    await verifier.verify(app);
  });
});