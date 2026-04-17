import { NodeSDK } from '@opentelemetry/sdk-node';
import { logs } from '@opentelemetry/api-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const serviceName = process.env.OTEL_SERVICE_NAME || 'subscription-service';
const otlpTraceUrl =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:43180/v1/traces';
const otlpLogUrl =
  process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
  'http://localhost:43180/v1/logs';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
  }),
  traceExporter: new OTLPTraceExporter({
    url: otlpTraceUrl,
  }),
  instrumentations: [getNodeAutoInstrumentations(), new GrpcInstrumentation()],
});

const logExporter = new OTLPLogExporter({
  url: otlpLogUrl,
});

const logProvider = new LoggerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
  }),
  processors: [
    new SimpleLogRecordProcessor(logExporter),
  ],
});

logs.setGlobalLoggerProvider(logProvider);

sdk.start();

const shutdown = async () => {
  await Promise.all([sdk.shutdown(), logProvider.shutdown()]);
};

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
