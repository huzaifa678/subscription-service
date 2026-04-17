import { Injectable, LoggerService } from '@nestjs/common';
import logger, { emitOtelLog } from '@lib/logger';

@Injectable()
export class WinstonLogger implements LoggerService {
  log(message: string, meta?: Record<string, unknown>) {
    logger.info(message, meta);
    emitOtelLog('info', message, meta);
  }

  error(message: string, trace?: unknown, meta?: Record<string, unknown>) {
    const errPayload: Record<string, unknown> = { ...meta };
    if (trace) errPayload.trace = trace;

    logger.error(message, errPayload);
    emitOtelLog('error', message, errPayload);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    logger.warn(message, meta);
    emitOtelLog('warn', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    logger.debug(message, meta);
    emitOtelLog('debug', message, meta);
  }

  verbose(message: string, meta?: Record<string, unknown>) {
    logger.verbose(message, meta);
    emitOtelLog('verbose', message, meta);
  }
}
