/** Minimal shape the use-cases need from an opossum circuit breaker. */
export interface Breaker<TArgs extends unknown[], TResult> {
  fire(...args: TArgs): Promise<TResult>;
  shutdown(): void;
}
