import * as winston from 'winston';
import { trace, context } from '@opentelemetry/api';
import { AnyValueMap, logs, SeverityNumber } from '@opentelemetry/api-logs';
import { TransformableInfo } from 'logform';

const isProd = process.env.NODE_ENV === 'production';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'subscription-service';

const otelLogger = logs.getLogger('subscription-service', '1.0.0');

function toOtelAttributes(obj: Record<string, unknown>): AnyValueMap {
  return obj as AnyValueMap;
}

function emitOtelLog(
  level: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const span = trace.getSpan(context.active());
  const attrs: Record<string, unknown> = {
    ...(meta ?? {}),
    severity: level,
  };
  if (span) {
    const ctx = span.spanContext();
    attrs['traceId'] = ctx.traceId;
    attrs['spanId'] = ctx.spanId;
  }

  otelLogger.emit({
    body: message,
    severityNumber: SeverityNumber.INFO,
    severityText: level.toUpperCase(),
    attributes: toOtelAttributes(attrs),
  });
}

const addTraceContext = winston.format((info) => {
  const span = trace.getSpan(context.active());

  if (span) {
    const ctx = span.spanContext();
    info.traceId = ctx.traceId;
    info.spanId = ctx.spanId;
  }

  info.severity = info.level;
  info['service.name'] = SERVICE_NAME;
  info['service.version'] = process.env.SERVICE_VERSION || '1.0.0';
  info['deployment.environment'] = process.env.NODE_ENV;

  return info;
});

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  addTraceContext(),
  winston.format.json(),
);

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  addTraceContext(),
  winston.format.printf(
    (info: TransformableInfo) => {
      const {
        timestamp = '',
        level = '',
        message = '',
        traceId,
        spanId,
        ...meta
      } = info;
      let msg = `${timestamp} [${level}]: ${message}`;
      if (traceId) msg += ` traceId=${traceId} spanId=${spanId}`;
      if (Object.keys(meta).length > 0) msg += ` ${JSON.stringify(meta)}`;
      return msg;
    },
  ),
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProd ? jsonFormat : devFormat,
  transports: [new winston.transports.Console()],
});

export { emitOtelLog };
export default logger;
