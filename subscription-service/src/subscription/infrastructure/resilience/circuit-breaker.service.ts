import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  create<TArgs extends unknown[], TResult>(
    action: (...args: TArgs) => Promise<TResult>,
    options?: CircuitBreaker.Options,
    fallback?: (...args: TArgs) => TResult | Promise<TResult>,
  ): CircuitBreaker<[...TArgs], TResult> {
    const breaker = new CircuitBreaker(action, {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      ...options,
    });

    if (fallback) {
      breaker.fallback(fallback);
    }

    breaker.on('open', () => this.logger.warn('Circuit breaker OPEN'));
    breaker.on('halfOpen', () => this.logger.log('Circuit breaker HALF-OPEN'));
    breaker.on('close', () => this.logger.log('Circuit breaker CLOSED'));
    breaker.on('failure', (err) =>
      this.logger.error('Circuit breaker FAILURE', err),
    );

    return breaker;
  }
}
