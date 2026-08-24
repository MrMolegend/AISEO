import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryTokenWallet, resetMemoryWallet } from '@/lib/tokens/memory-wallet';
import {
  reservationKey,
  finalizeKey,
  refundKey,
  isValidSubmissionId,
  MAX_KEY_LENGTH,
} from '@/lib/tokens/idempotency';
import { isPlatformError } from '@/lib/errors';

/**
 * Token accounting rules.
 *
 * These run against the in-memory driver, which exists to fail in the same
 * places the database does. The same scenarios are verified against the real
 * Postgres functions — see the self-test recorded in the migration commit — so
 * this suite is checking that the two drivers agree, not inventing its own idea
 * of correct.
 *
 * The rule under test throughout: money moves once, or not at all.
 */

const USER = 'user-1';
const OTHER = 'user-2';
const JOB = 'job-1';
const JOB_2 = 'job-2';

let wallet: MemoryTokenWallet;

beforeEach(async () => {
  resetMemoryWallet();
  wallet = new MemoryTokenWallet();
  await wallet.bootstrap(USER, { displayName: 'Test', welcomeTokens: 500 });
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'NO_ERROR';
  } catch (error) {
    return isPlatformError(error) ? error.code : 'NOT_A_PLATFORM_ERROR';
  }
}

describe('bootstrap', () => {
  it('applies the welcome credit exactly once, however many times it is called', async () => {
    await wallet.bootstrap(USER, { displayName: 'Test', welcomeTokens: 500 });
    await wallet.bootstrap(USER, { displayName: 'Test', welcomeTokens: 500 });

    expect(await wallet.getBalance(USER)).toEqual({ available: 500, reserved: 0 });
  });

  it('grants nothing when the welcome grant is zero', async () => {
    await wallet.bootstrap(OTHER, { welcomeTokens: 0 });
    expect(await wallet.getBalance(OTHER)).toEqual({ available: 0, reserved: 0 });
    expect(await wallet.history(OTHER)).toHaveLength(0);
  });

  it('keeps wallets separate', async () => {
    await wallet.bootstrap(OTHER, { welcomeTokens: 100 });
    expect((await wallet.getBalance(USER)).available).toBe(500);
    expect((await wallet.getBalance(OTHER)).available).toBe(100);
  });
});

describe('reserve', () => {
  it('moves tokens from available to reserved', async () => {
    const result = await wallet.reserve({
      userId: USER,
      jobId: JOB,
      amount: 100,
      idempotencyKey: reservationKey('sub-1'),
      description: 'Competitor Intelligence',
    });

    expect(result).toMatchObject({ available: 400, reserved: 100, replayed: false });
  });

  it('replays a double-click instead of charging twice', async () => {
    const key = reservationKey('sub-1');
    const first = await wallet.reserve({
      userId: USER,
      jobId: JOB,
      amount: 100,
      idempotencyKey: key,
      description: 'Competitor Intelligence',
    });
    const second = await wallet.reserve({
      userId: USER,
      jobId: JOB,
      amount: 100,
      idempotencyKey: key,
      description: 'Competitor Intelligence',
    });

    expect(second.replayed).toBe(true);
    expect(second.ledgerId).toBe(first.ledgerId);
    expect(await wallet.getBalance(USER)).toEqual({ available: 400, reserved: 100 });
    expect(await wallet.history(USER)).toHaveLength(2); // welcome + one reservation
  });

  it('refuses to overdraw rather than going negative', async () => {
    expect(
      await codeOf(
        wallet.reserve({
          userId: USER,
          jobId: JOB,
          amount: 501,
          idempotencyKey: reservationKey('sub-big'),
          description: 'Too much',
        }),
      ),
    ).toBe('INSUFFICIENT_TOKENS');

    expect(await wallet.getBalance(USER)).toEqual({ available: 500, reserved: 0 });
  });

  it('lets a sequence of reservations drain the balance to exactly zero', async () => {
    for (let i = 0; i < 5; i += 1) {
      await wallet.reserve({
        userId: USER,
        jobId: `job-${i}`,
        amount: 100,
        idempotencyKey: reservationKey(`sub-${i}`),
        description: 'Report',
      });
    }
    expect(await wallet.getBalance(USER)).toEqual({ available: 0, reserved: 500 });

    // And the sixth is refused, not allowed to go negative.
    expect(
      await codeOf(
        wallet.reserve({
          userId: USER,
          jobId: 'job-6',
          amount: 100,
          idempotencyKey: reservationKey('sub-6'),
          description: 'Report',
        }),
      ),
    ).toBe('INSUFFICIENT_TOKENS');
  });

  it('rejects a non-positive amount', async () => {
    expect(
      await codeOf(
        wallet.reserve({
          userId: USER,
          jobId: JOB,
          amount: 0,
          idempotencyKey: reservationKey('sub-zero'),
          description: 'Nothing',
        }),
      ),
    ).toBe('WALLET_ERROR');
  });
});

describe('finalize', () => {
  beforeEach(async () => {
    await wallet.reserve({
      userId: USER,
      jobId: JOB,
      amount: 100,
      idempotencyKey: reservationKey('sub-1'),
      description: 'Competitor Intelligence',
    });
  });

  it('turns the hold into a spend without touching available balance', async () => {
    const result = await wallet.finalize({
      userId: USER,
      jobId: JOB,
      idempotencyKey: finalizeKey(JOB),
    });

    // Available was already reduced at reservation; finalising only releases
    // the hold. The tokens are now spent.
    expect(result).toMatchObject({ available: 400, reserved: 0, replayed: false });
  });

  it('is idempotent under the same key', async () => {
    await wallet.finalize({ userId: USER, jobId: JOB, idempotencyKey: finalizeKey(JOB) });
    const again = await wallet.finalize({
      userId: USER,
      jobId: JOB,
      idempotencyKey: finalizeKey(JOB),
    });

    expect(again.replayed).toBe(true);
    expect(await wallet.getBalance(USER)).toEqual({ available: 400, reserved: 0 });
  });

  it('is idempotent even under a different key, because the hold is already settled', async () => {
    await wallet.finalize({ userId: USER, jobId: JOB, idempotencyKey: finalizeKey(JOB) });
    const again = await wallet.finalize({
      userId: USER,
      jobId: JOB,
      idempotencyKey: 'finalize:retry-with-another-key',
    });

    expect(again.replayed).toBe(true);
    expect(await wallet.getBalance(USER)).toEqual({ available: 400, reserved: 0 });
  });

  it('refuses to settle a job that never reserved anything', async () => {
    expect(
      await codeOf(
        wallet.finalize({
          userId: USER,
          jobId: 'job-that-never-existed',
          idempotencyKey: finalizeKey('job-that-never-existed'),
        }),
      ),
    ).toBe('WALLET_ERROR');
  });
});

describe('refund', () => {
  beforeEach(async () => {
    await wallet.reserve({
      userId: USER,
      jobId: JOB,
      amount: 100,
      idempotencyKey: reservationKey('sub-1'),
      description: 'Competitor Intelligence',
    });
  });

  it('returns the hold to spendable balance', async () => {
    const result = await wallet.refund({
      userId: USER,
      jobId: JOB,
      idempotencyKey: refundKey(JOB),
      reason: 'Research provider unavailable',
    });

    expect(result).toMatchObject({ available: 500, reserved: 0, replayed: false });
  });

  /**
   * The requirement is that a system failure refunds exactly once. A retry
   * storm generates fresh keys, so key-based idempotency alone would not be
   * enough — settlement state has to be checked too.
   */
  it('refunds exactly once across repeated attempts with different keys', async () => {
    await wallet.refund({
      userId: USER,
      jobId: JOB,
      idempotencyKey: refundKey(JOB),
      reason: 'System failure',
    });

    for (const key of ['refund:retry-a', 'refund:retry-b', 'refund:retry-c']) {
      const again = await wallet.refund({
        userId: USER,
        jobId: JOB,
        idempotencyKey: key,
        reason: 'System failure',
      });
      expect(again.replayed).toBe(true);
    }

    expect(await wallet.getBalance(USER)).toEqual({ available: 500, reserved: 0 });
  });

  it('will not refund a job that was already finalised', async () => {
    await wallet.finalize({ userId: USER, jobId: JOB, idempotencyKey: finalizeKey(JOB) });

    const refunded = await wallet.refund({
      userId: USER,
      jobId: JOB,
      idempotencyKey: refundKey(JOB),
      reason: 'Too late',
    });

    expect(refunded.replayed).toBe(true);
    expect(await wallet.getBalance(USER)).toEqual({ available: 400, reserved: 0 });
  });

  /**
   * The bug the database self-test caught: settle-once was scoped to the job,
   * so a second reservation on a job that had already settled could never be
   * settled and its hold was stranded forever.
   */
  it('settles a second reservation on a job that already settled once', async () => {
    await wallet.refund({
      userId: USER,
      jobId: JOB,
      idempotencyKey: refundKey(JOB),
      reason: 'First attempt failed',
    });

    await wallet.reserve({
      userId: USER,
      jobId: JOB,
      amount: 100,
      idempotencyKey: reservationKey('sub-2'),
      description: 'Retry',
    });

    const finalised = await wallet.finalize({
      userId: USER,
      jobId: JOB,
      idempotencyKey: 'finalize:second-attempt',
    });

    expect(finalised.replayed).toBe(false);
    expect(await wallet.getBalance(USER)).toEqual({ available: 400, reserved: 0 });
  });

  it('leaves other jobs alone', async () => {
    await wallet.reserve({
      userId: USER,
      jobId: JOB_2,
      amount: 150,
      idempotencyKey: reservationKey('sub-2'),
      description: 'Lead Finder',
    });

    await wallet.refund({
      userId: USER,
      jobId: JOB,
      idempotencyKey: refundKey(JOB),
      reason: 'System failure',
    });

    expect(await wallet.getBalance(USER)).toEqual({ available: 350, reserved: 150 });
  });
});

describe('grant', () => {
  it('adds tokens and records the reason', async () => {
    const result = await wallet.grant({
      userId: USER,
      amount: 250,
      type: 'admin_grant',
      idempotencyKey: 'grant:support-ticket-8891',
      description: 'Goodwill credit',
    });

    expect(result.available).toBe(750);
    const [latest] = await wallet.history(USER);
    expect(latest?.type).toBe('admin_grant');
    expect(latest?.description).toBe('Goodwill credit');
  });

  it('does not stack when the same reference is granted twice', async () => {
    const key = 'grant:support-ticket-8891';
    await wallet.grant({
      userId: USER,
      amount: 250,
      type: 'admin_grant',
      idempotencyKey: key,
      description: 'Goodwill credit',
    });
    const again = await wallet.grant({
      userId: USER,
      amount: 250,
      type: 'admin_grant',
      idempotencyKey: key,
      description: 'Goodwill credit',
    });

    expect(again.replayed).toBe(true);
    expect((await wallet.getBalance(USER)).available).toBe(750);
  });

  it('allows a negative adjustment but not a negative grant', async () => {
    const adjusted = await wallet.grant({
      userId: USER,
      amount: -100,
      type: 'adjustment',
      idempotencyKey: 'grant:correction-1',
      description: 'Correcting an operator error',
    });
    expect(adjusted.available).toBe(400);

    expect(
      await codeOf(
        wallet.grant({
          userId: USER,
          amount: -100,
          type: 'admin_grant',
          idempotencyKey: 'grant:bad-1',
          description: 'Should not be possible',
        }),
      ),
    ).toBe('WALLET_ERROR');
  });

  it('will not let an adjustment overdraw', async () => {
    expect(
      await codeOf(
        wallet.grant({
          userId: USER,
          amount: -600,
          type: 'adjustment',
          idempotencyKey: 'grant:correction-2',
          description: 'Too far',
        }),
      ),
    ).toBe('INSUFFICIENT_TOKENS');

    expect((await wallet.getBalance(USER)).available).toBe(500);
  });

  it('supports purchase as a type, for the payment provider that does not exist yet', async () => {
    const result = await wallet.grant({
      userId: USER,
      amount: 300,
      type: 'purchase',
      idempotencyKey: 'grant:future-checkout-session',
      description: 'Builder bundle',
    });
    expect(result.available).toBe(800);
    expect((await wallet.history(USER))[0]?.type).toBe('purchase');
  });
});

describe('history', () => {
  it('reads newest first and shows every movement', async () => {
    await wallet.reserve({
      userId: USER,
      jobId: JOB,
      amount: 100,
      idempotencyKey: reservationKey('sub-1'),
      description: 'Competitor Intelligence',
    });
    await wallet.refund({
      userId: USER,
      jobId: JOB,
      idempotencyKey: refundKey(JOB),
      reason: 'Provider unavailable',
    });

    const entries = await wallet.history(USER);
    expect(entries.map((e) => e.type)).toEqual([
      'refund',
      'reservation',
      'welcome_credit',
    ]);
    expect(entries.map((e) => e.balanceAfter)).toEqual([500, 400, 500]);
  });

  it('never shows one account another account rows', async () => {
    await wallet.bootstrap(OTHER, { welcomeTokens: 100 });
    await wallet.grant({
      userId: OTHER,
      amount: 50,
      type: 'admin_grant',
      idempotencyKey: 'grant:other-1',
      description: 'Other user credit',
    });

    const mine = await wallet.history(USER);
    expect(mine.every((e) => e.description !== 'Other user credit')).toBe(true);
    expect(mine).toHaveLength(1);
  });
});

describe('idempotency keys', () => {
  it('distinguishes finalise from refund on the same job', () => {
    expect(finalizeKey(JOB)).not.toBe(refundKey(JOB));
  });

  it('stays inside the length the database column allows', () => {
    const long = 'x'.repeat(500);
    expect(reservationKey(long).length).toBeLessThanOrEqual(MAX_KEY_LENGTH);
  });

  it('does not collapse two long keys that share a prefix', () => {
    const a = reservationKey('x'.repeat(400) + 'a');
    const b = reservationKey('x'.repeat(400) + 'b');
    expect(a).not.toBe(b);
  });

  it('accepts URL-safe submission ids and rejects anything else', () => {
    expect(isValidSubmissionId('a1B2c3D4e5F6')).toBe(true);
    expect(isValidSubmissionId('with-dash_and_underscore')).toBe(true);
    expect(isValidSubmissionId('short')).toBe(false);
    expect(isValidSubmissionId('has spaces here')).toBe(false);
    expect(isValidSubmissionId('semi;colon;injection')).toBe(false);
    expect(isValidSubmissionId(12345678)).toBe(false);
    expect(isValidSubmissionId(null)).toBe(false);
  });
});
