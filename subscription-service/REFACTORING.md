# Refactoring Notes — subscription-service

This document records the SOLID/clean-code refactor of the subscription-service
(NestJS + gRPC + GraphQL + Kafka), the violations that existed before, why each
one mattered, and how it was fixed.

Public APIs were preserved. The resolver and gRPC unit suites pass (4 tests),
the TypeScript build typechecks, and ESLint is clean.

## What was added

| File | Role | Pattern |
|------|------|---------|
| `src/lib/tracing.ts` | `withSpan(name, fn)` span lifecycle wrapper | Higher-order / decorator |
| `src/mapper/subscription.mapper.ts` (extended) | Entity → event payload mapping | Mapper |
| `src/mapper/subscription.proto-mapper.ts` | Entity → protobuf message mapping | Mapper |
| `src/service/subscription.service.ts` (slimmed) | Orchestration + breaker registry | Registry |

---

## 1. SRP — `SubscriptionService` did too much

The service mixed breaker construction, business orchestration, **event-payload
construction** (hand-building objects with `.toISOString()` on every field),
tracing lifecycle, and shutdown management. Too many reasons to change one class.
The fixes below each peel off one of those responsibilities.

---

## 2. DRY + SRP — event payloads hand-built inline (twice)

The `subscription.created` and `subscription.updated` payloads repeated the same
7-field `.toISOString()` block. Mapping is the Mapper's job, and a
`SubscriptionMapper` already existed. The duplication also hid a copy-paste log
bug (`update()` logged `"subscription.created"`).

### Before

```ts
// create()
await this.eventsProducer.publishEvent('subscription.created', {
  subscriptionId: result.id,
  userId: result.userId, planId: result.planId, status: result.status,
  currentPeriodStart: result.currentPeriodStart.toISOString(),
  currentPeriodEnd:   result.currentPeriodEnd.toISOString(),
  cancelAtPeriodEnd:  result.cancelAtPeriodEnd,
  createdAt: result.createdAt.toISOString(),
});

// update()  — near-identical, plus a copy-paste log bug
await this.eventsProducer.publishEvent('subscription.updated', {
  subscriptionId: updated.id,
  userId: updated.userId, planId: updated.planId, status: updated.status,
  currentPeriodStart: updated.currentPeriodStart.toISOString(),
  currentPeriodEnd:   updated.currentPeriodEnd.toISOString(),
  cancelAtPeriodEnd:  updated.cancelAtPeriodEnd,
  updatedAt: updated.updatedAt.toISOString(),
});
this.logger.log(`Published subscription.created event for ${updated.id}`); // ← wrong topic
```

### After

```ts
// mapper/subscription.mapper.ts
private static toEventBase(entity: SubscriptionEntity) {
  return {
    subscriptionId: entity.id,
    userId: entity.userId, planId: entity.planId, status: entity.status,
    currentPeriodStart: entity.currentPeriodStart.toISOString(),
    currentPeriodEnd:   entity.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd:  entity.cancelAtPeriodEnd,
  };
}
static toCreatedEvent(e) { return { ...this.toEventBase(e), createdAt: e.createdAt.toISOString() }; }
static toUpdatedEvent(e) { return { ...this.toEventBase(e), updatedAt: e.updatedAt.toISOString() }; }
```

```ts
// service — one publish helper; correct topic in the log by construction
await this.publish('subscription.created', 'service.createSubscription',
  SubscriptionMapper.toCreatedEvent(result), result.id, { rethrow: true });

await this.publish('subscription.updated', 'service.updateSubscription',
  SubscriptionMapper.toUpdatedEvent(updated), updated.id, { rethrow: false });
```

The `30 * 24 * 60 * 60 * 1000` billing-period magic number was also named:
`const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;`.

---

## 3. OCP — shutdown forgot a breaker (a real resource leak)

`onApplicationShutdown` shut down `findByIdBreaker` and `createBreaker` but
**silently skipped `findByUserIdBreaker`**. Every new breaker forced you to
remember to edit shutdown too — and that coupling had already failed.

### Before

```ts
async onApplicationShutdown(signal?: string) {
  try {
    if (this.findByIdBreaker) { this.findByIdBreaker.shutdown(); this.logger.log('findByIdBreaker shutdown completed'); }
    if (this.createBreaker)   { this.createBreaker.shutdown();   this.logger.log('createBreaker shutdown completed'); }
    // findByUserIdBreaker is never shut down  ← leak
  } catch (err) { this.logger.error('Error during circuit breaker shutdown', err); }
}
```

### After

```ts
// Registry: each breaker registers itself at construction.
private readonly breakers: Array<{ shutdown(): void }> = [];

private registerBreaker<TArgs extends unknown[], TResult>(breaker: Breaker<TArgs, TResult>) {
  this.breakers.push(breaker);
  return breaker;
}

this.findByIdBreaker     = this.registerBreaker(this.breakerService.create(/* ... */));
this.findByUserIdBreaker = this.registerBreaker(this.breakerService.create(/* ... */));
this.createBreaker       = this.registerBreaker(this.breakerService.create(/* ... */));

async onApplicationShutdown(signal?: string) {
  this.logger.log(`Application shutdown signal received: ${signal}`);
  for (const breaker of this.breakers) {
    try { breaker.shutdown(); }
    catch (err) { this.logger.error('Error during circuit breaker shutdown', err); }
  }
}
```

The 3× repeated fallback was also collapsed into a helper:

```ts
private unavailable(message: string): never { throw new ServiceUnavailableException(message); }
```

Adding a breaker now requires **zero** changes to shutdown — closed for
modification, open for extension.

---

## 4. DRY — identical span boilerplate across 5 methods

The resolver (3 methods) and gRPC controller (2 methods) each repeated the same
`startSpan → try → setStatus → catch → finally end()` skeleton (~15 lines each).
It also drifted: some set OK status, some did not; some passed a parent context,
some did not.

### Before

```ts
@Mutation(() => SubscriptionEntity)
async createSubscription(@Args('input') input: CreateSubscriptionInput) {
  this.logger.log('subscription-resolver: createSubscription starting');
  const span = tracer.startSpan('subscription.create', undefined, context.active());
  try {
    const result = await this.service.create(input);
    this.logger.log(`subscription-resolver: createSubscription succeeded id=${result.id}`);
    span.setStatus({ code: 1 });
    return result;
  } catch (error) {
    this.logger.error('subscription-resolver: createSubscription failed', error);
    span.setStatus({ code: 2, message: (error as Error)?.message || 'unknown' });
    throw error;
  } finally {
    span.end();
  }
}
```

### After

```ts
// lib/tracing.ts — one definition of the span lifecycle
export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  const span = tracer.startSpan(name, undefined, context.active());
  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : 'unknown' });
    throw error;
  } finally {
    span.end();
  }
}
```

```ts
// resolver — each method is a one-liner over a shared trace() wrapper
@Mutation(() => SubscriptionEntity)
createSubscription(@Args('input') input: CreateSubscriptionInput) {
  return this.trace('createSubscription', 'subscription.create', () => this.service.create(input));
}

private async trace<T>(label: string, spanName: string, action: () => Promise<T>): Promise<T> {
  this.logger.log(`subscription-resolver: ${label} starting`);
  try {
    const result = await withSpan(spanName, action);
    this.logger.log(`subscription-resolver: ${label} succeeded`);
    return result;
  } catch (error) {
    this.logger.error(`subscription-resolver: ${label} failed`, error);
    throw error;
  }
}
```

---

## 5. SRP + typing — proto mapping (`sub: any`) inside the controller

gRPC wire-format mapping lived in the controller, typed as `any` (which discards
all compiler checking). Mapping belongs in a mapper, and it should be typed.

### Before

```ts
private mapToProto(sub: any): subscription_pb.GetSubscriptionResponse {
  return create(subscription_pb.GetSubscriptionResponseSchema, {
    id: sub.id, userId: sub.userId, planId: sub.planId, status: sub.status,
    currentPeriodStart: { seconds: BigInt(Math.floor(sub.currentPeriodStart.getTime() / 1000)), nanos: 0 },
    currentPeriodEnd:   { seconds: BigInt(Math.floor(sub.currentPeriodEnd.getTime()   / 1000)), nanos: 0 },
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    createdAt: { seconds: BigInt(Math.floor(sub.createdAt.getTime() / 1000)), nanos: 0 },
    updatedAt: { seconds: BigInt(Math.floor(sub.updatedAt.getTime() / 1000)), nanos: 0 },
  });
}
```

### After

```ts
// mapper/subscription.proto-mapper.ts — typed, with the timestamp repetition factored out
const toTimestamp = (date: Date) => ({ seconds: BigInt(Math.floor(date.getTime() / 1000)), nanos: 0 });

export class SubscriptionProtoMapper {
  static toResponse(sub: SubscriptionEntity): subscription_pb.GetSubscriptionResponse {
    return create(subscription_pb.GetSubscriptionResponseSchema, {
      id: sub.id, userId: sub.userId, planId: sub.planId, status: sub.status,
      currentPeriodStart: toTimestamp(sub.currentPeriodStart),
      currentPeriodEnd:   toTimestamp(sub.currentPeriodEnd),
      cancelAtPeriodEnd:  sub.cancelAtPeriodEnd,
      createdAt: toTimestamp(sub.createdAt),
      updatedAt: toTimestamp(sub.updatedAt),
    });
  }
}
```

The controller now only handles the RPC and calls
`SubscriptionProtoMapper.toResponse(sub)`.

---

## 6. Test fixes enabled by the refactor

The gRPC controller spec had never compiled (a plain request object was missing
the protobuf `$typeName`), so its assertions never ran. It was fixed to build the
request via protobuf `create()`, which then exposed a latent `BigInt` vs `number`
assertion mismatch — also corrected. The suite now passes.

---

## Outcome

- Mapping (DTO/event/proto), resilience plumbing, and tracing each have one home.
- Adding a breaker no longer risks a shutdown leak.
- Resolver and gRPC unit suites pass; `tsc` build and ESLint are clean.
- Not run here: the integration spec (`subscription.service.int.spec.ts`) needs
  Docker/testcontainers — you can run it to confirm the event-publishing path end-to-end.
