import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  adminGrantsEnabled,
  assertAdminGrantAuthorised,
  grantTokensAsAdmin,
} from '@/lib/tokens/admin-grant';
import { getTokenWallet, resetTokenWalletCache } from '@/lib/tokens';
import { resetMemoryWallet } from '@/lib/tokens/memory-wallet';
import { resetEnvCache } from '@/lib/env';
import { isPlatformError } from '@/lib/errors';

/**
 * The only operation that creates spendable value from nothing.
 *
 * Everything here is about reachability rather than arithmetic. An open grant
 * endpoint is not a bug that degrades the product — it *is* the product, given
 * away. So these assert the closed states as hard as the open one: no secret
 * means no endpoint, a wrong secret is indistinguishable from no endpoint, and
 * the same operator reference twice is one grant.
 */

const USER = '33333333-3333-4333-8333-333333333333';
const SECRET = 'a-secret-long-enough-to-be-accepted-in-tests';

function withSecret(secret: string | undefined) {
  if (secret === undefined) delete process.env.ADMIN_GRANT_SECRET;
  else process.env.ADMIN_GRANT_SECRET = secret;
  resetEnvCache();
}

beforeEach(() => {
  resetMemoryWallet();
  resetTokenWalletCache();
  withSecret(SECRET);
});

afterEach(() => {
  withSecret(undefined);
});

describe('when no grant secret is configured', () => {
  it('has no grant endpoint at all', () => {
    withSecret(undefined);

    expect(adminGrantsEnabled()).toBe(false);
    // Not "open", not "warns" — refused. A deployment that forgot to set the
    // secret must fail closed.
    expect(() => assertAdminGrantAuthorised(undefined)).toThrow();
    expect(() => assertAdminGrantAuthorised('anything')).toThrow();
  });

  it('refuses to boot at all with a secret too short to be one', () => {
    withSecret('short');

    // Stronger than a runtime check: the environment schema rejects it, so a
    // deployment carrying a guessable grant secret does not start. Reading the
    // environment is what raises, which is why this asserts on the read.
    expect(() => adminGrantsEnabled()).toThrow(/ADMIN_GRANT_SECRET/);
  });
});

describe('authorisation', () => {
  it('accepts only the exact secret', () => {
    expect(adminGrantsEnabled()).toBe(true);
    expect(() => assertAdminGrantAuthorised(SECRET)).not.toThrow();

    for (const wrong of [
      '',
      null,
      undefined,
      `${SECRET} `,
      SECRET.slice(0, -1),
      `${SECRET}x`,
      SECRET.toUpperCase(),
    ]) {
      expect(() => assertAdminGrantAuthorised(wrong)).toThrow();
    }
  });

  it('does not admit that the endpoint exists', () => {
    const error = (() => {
      try {
        assertAdminGrantAuthorised('wrong');
        return null;
      } catch (thrown) {
        return thrown;
      }
    })();

    expect(isPlatformError(error)).toBe(true);
    // NOT_FOUND, not FORBIDDEN: a 403 confirms there is something here to find.
    expect(isPlatformError(error) && error.code).toBe('NOT_FOUND');
    expect(isPlatformError(error) && error.status).toBe(404);
  });

  it('never puts the secret in the error it raises', () => {
    try {
      assertAdminGrantAuthorised('wrong');
    } catch (thrown) {
      expect(JSON.stringify(thrown)).not.toContain(SECRET);
      expect(String(thrown)).not.toContain(SECRET);
      expect(String(thrown)).not.toContain(SECRET.slice(0, 8));
    }
  });
});

describe('granting', () => {
  it('credits the wallet and records why', async () => {
    const result = await grantTokensAsAdmin({
      userId: USER,
      amount: 300,
      reference: 'support-ticket-4821',
      reason: 'Goodwill credit for a failed run',
    });

    expect(result.available).toBe(300);
    expect(result.replayed).toBe(false);

    const ledger = await (await getTokenWallet()).history(USER, 10);
    expect(ledger[0]?.type).toBe('admin_grant');
    expect(ledger[0]?.amount).toBe(300);
    expect(ledger[0]?.description).toContain('Goodwill');
    expect(ledger[0]?.metadata.reference).toBe('support-ticket-4821');
  });

  it('is idempotent on the operator reference', async () => {
    const input = {
      userId: USER,
      amount: 300,
      reference: 'support-ticket-4821',
      reason: 'Goodwill credit',
    };

    await grantTokensAsAdmin(input);
    const second = await grantTokensAsAdmin(input);

    // Re-running the same command does not stack credits.
    expect(second.replayed).toBe(true);
    expect(second.available).toBe(300);
  });

  it('records a negative correction as an adjustment, not a grant', async () => {
    await grantTokensAsAdmin({
      userId: USER,
      amount: 300,
      reference: 'initial-credit',
      reason: 'Initial',
    });
    await grantTokensAsAdmin({
      userId: USER,
      amount: -100,
      reference: 'clawback-9',
      reason: 'Duplicate credit reversed',
    });

    const balance = await (await getTokenWallet()).getBalance(USER);
    expect(balance.available).toBe(200);

    const ledger = await (await getTokenWallet()).history(USER, 10);
    expect(ledger[0]?.type).toBe('adjustment');
  });

  it('refuses a grant with no traceable reference', async () => {
    await expect(
      grantTokensAsAdmin({ userId: USER, amount: 50, reference: 'x', reason: 'why' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('refuses a zero or fractional amount', async () => {
    for (const amount of [0, 1.5, -0.5, Number.NaN]) {
      await expect(
        grantTokensAsAdmin({
          userId: USER,
          amount,
          reference: 'reference-ok',
          reason: 'why',
        }),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    }
  });
});

describe('the wallet itself', () => {
  it('will not overdraw, however the request is shaped', async () => {
    const wallet = await getTokenWallet();
    await wallet.bootstrap(USER, { welcomeTokens: 0 });
    await wallet.grant({
      userId: USER,
      amount: 100,
      type: 'admin_grant',
      idempotencyKey: 'grant:overdraw-test',
      description: 'Test',
    });

    await expect(
      wallet.reserve({
        userId: USER,
        jobId: '44444444-4444-4444-8444-444444444444',
        amount: 101,
        idempotencyKey: 'reserve:overdraw-test',
        description: 'Too expensive',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_TOKENS' });

    expect(await wallet.getBalance(USER)).toEqual({ available: 100, reserved: 0 });
  });

  it('has no way to set a balance directly', async () => {
    const wallet = await getTokenWallet();
    // A balance is only ever the result of an operation with a reason attached.
    // That is what makes the ledger a complete account of how it got there, and
    // it is enforced by the interface having no such method.
    expect(wallet).not.toHaveProperty('setBalance');
    expect(Object.keys(Object.getPrototypeOf(wallet))).not.toContain('setBalance');
  });
});
