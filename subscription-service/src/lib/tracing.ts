import { trace, context, Span, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('subscription-service');

/**
 * Runs `fn` inside a fresh OpenTelemetry span made active for its duration.
 *
 * Centralizes the start/activate/set-status/end lifecycle that was previously
 * copy-pasted across every resolver, controller and service method, so callers
 * express only the work they care about (a small higher-order/decorator
 * pattern around the span boilerplate).
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan(name, undefined, context.active());

  try {
    const result = await context.with(
      trace.setSpan(context.active(), span),
      () => fn(span),
    );
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  } finally {
    span.end();
  }
}
