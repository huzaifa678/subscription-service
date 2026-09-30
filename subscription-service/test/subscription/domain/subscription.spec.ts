import { Subscription } from '@domain/subscription';
import { SubscriptionStatus } from '@domain/subscription-status.enum';
import { SubscriptionDomainEvent } from '@domain/event/subscription-event';

const newInput = { userId: 'user-1', planId: 'plan-1' };

/**
 * Drive a subscription through a sequence of commands, capturing the ordered event
 * stream (the aggregate only exposes currently-pending events, and clears them on
 * `markPersisted`, so we snapshot them after each step). Returns the final
 * aggregate and its full stream — both derived from the *same* aggregate id.
 */
function buildWithStream(): {
  sub: Subscription;
  events: SubscriptionDomainEvent[];
} {
  const events: SubscriptionDomainEvent[] = [];
  let sub = Subscription.create(newInput);
  events.push(...sub.pendingEvents());
  sub = sub.markPersisted().applyUpdate({ cancelAtPeriodEnd: true });
  events.push(...sub.pendingEvents());
  sub = sub.markPersisted().changeStatus(SubscriptionStatus.PAST_DUE);
  events.push(...sub.pendingEvents());
  return { sub, events };
}

describe('Subscription (event-sourced aggregate)', () => {
  describe('create', () => {
    it('raises a single created event and starts at version 1', () => {
      const sub = Subscription.create(newInput);
      const pending = sub.pendingEvents();

      expect(pending).toHaveLength(1);
      expect(pending[0].type).toBe('subscription.created');
      expect(sub.version).toBe(1);
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub.userId).toBe('user-1');
      expect(sub.cancelAtPeriodEnd).toBe(false);
    });

    it('opens a 30-day billing period', () => {
      const sub = Subscription.create(newInput);
      const days =
        (sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) /
        (24 * 60 * 60 * 1000);
      expect(Math.round(days)).toBe(30);
    });
  });

  describe('commands raise events and advance the version', () => {
    it('applyUpdate raises an updated event carrying the patch', () => {
      const sub = Subscription.create(newInput)
        .markPersisted()
        .applyUpdate({ status: SubscriptionStatus.PAST_DUE });

      const pending = sub.pendingEvents();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        type: 'subscription.updated',
        status: SubscriptionStatus.PAST_DUE,
      });
      expect(sub.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(sub.version).toBe(2);
    });

    it('cancel moves to CANCELED and clears the scheduled-cancel flag', () => {
      const sub = Subscription.create(newInput)
        .markPersisted()
        .cancelAtEndOfPeriod()
        .markPersisted()
        .cancel();

      expect(sub.status).toBe(SubscriptionStatus.CANCELED);
      expect(sub.cancelAtPeriodEnd).toBe(false);
      expect(sub.version).toBe(3);
    });

    it('renew starts the next period from the current period end', () => {
      const created = Subscription.create(newInput).markPersisted();
      const renewed = created.renew();

      expect(renewed.currentPeriodStart).toEqual(created.currentPeriodEnd);
      expect(renewed.status).toBe(SubscriptionStatus.ACTIVE);
      expect(renewed.version).toBe(2);
    });
  });

  describe('markPersisted', () => {
    it('clears pending events without changing state', () => {
      const sub = Subscription.create(newInput);
      const persisted = sub.markPersisted();

      expect(persisted.pendingEvents()).toHaveLength(0);
      expect(persisted.version).toBe(sub.version);
      expect(persisted.status).toBe(sub.status);
    });
  });

  describe('replay', () => {
    it('rebuilds identical state by folding the full stream', () => {
      const { sub, events } = buildWithStream();

      expect(events).toHaveLength(3);

      const replayed = Subscription.replay(events);
      expect(replayed.toProps()).toEqual(sub.toProps());
      expect(replayed.pendingEvents()).toHaveLength(0);
      expect(replayed.version).toBe(sub.version);
    });

    it('throws on an empty stream', () => {
      expect(() => Subscription.replay([])).toThrow();
    });
  });

  describe('fromSnapshot + replayAll', () => {
    it('folds a tail onto a snapshot to reach the latest state', () => {
      const { sub, events } = buildWithStream();

      // Snapshot at version 1 (the created event), then fold the remaining tail.
      const snapshot = Subscription.fromSnapshot(
        Subscription.replay([events[0]]).toProps(),
      );
      const rebuilt = snapshot.replayAll(events.slice(1));

      expect(rebuilt.toProps()).toEqual(sub.toProps());
      expect(rebuilt.version).toBe(sub.version);
    });
  });
});
