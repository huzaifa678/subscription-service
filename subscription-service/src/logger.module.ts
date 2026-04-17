import { WinstonLogger } from "@logger/winston.logger";
import { Module } from "@nestjs/common/decorators/modules/module.decorator";

@Module({
  providers: [WinstonLogger],
  exports: [WinstonLogger],
})
export class LoggerModule {}