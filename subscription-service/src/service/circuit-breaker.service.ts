import { Injectable, Logger } from '@nestjs/common';
import * as CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  create<T extends (...args: any[]) => Promise<any>>(
    action: T,
    options?: CircuitBreaker.options,
    fallback?: (...args: Parameters<T>) => any,
  ): CircuitBreaker {
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
