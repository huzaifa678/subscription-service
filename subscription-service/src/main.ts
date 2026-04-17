import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { WinstonLogger } from '@logger/winston.logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = app.get(WinstonLogger);
  app.useLogger(logger);

  app.enableShutdownHooks();
  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: 'subscription',
      protoPath: 'src/proto/subscription.proto',
      url: '0.0.0.0:50051',
    },
  });

  await app.startAllMicroservices();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 8081;
  await app.listen(port);

  logger.log(`Subscription service running on port ${port}`);

  process.on('SIGINT', () => void logger.log('SIGINT received'));
  process.on('SIGTERM', () => void logger.log('SIGTERM received'));
}
bootstrap();
