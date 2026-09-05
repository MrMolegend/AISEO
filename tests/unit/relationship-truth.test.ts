import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RELATIONSHIP_STATES,
  RELATIONSHIP_STATE_LABEL,
  VERIFIED_DIRECT_STATES,
  CONFIRMATION_ACTIONS,
  warmPathSentence,
  isWarmPath,
} from '@/schemas/relationship';
import {
  buildAuthorizationUrl,
  generatePkce,
  generateState,
  validateCallback,
  OPENID_SCOPES,
} from '@/lib/linkedin/oauth';
import { resetEnvCache } from '@/lib/env';
import {
  getRelationshipStore,
  resetMemoryRelationshipStore,
  resetRelationshipStoreCache,
} from '@/lib/relationships/store';

/**
 * The relationship truth table and the LinkedIn honesty boundary.
 *
 * These tests pin the exact rules the specification demands: what may be
 * called a verified direct connection, what a colleague's confirmation can
 * and cannot write, and what the OAuth surface exposes.
 */

const EMPLOYEE = '77777777-7777-4777-8777-777777777777';
const CONTACT = '88888888-8888-4888-8888-888888888888';

const savedEnv = { ...process.env };

function setLinkedInEnv(mode: string, configured = true): void {
  process.env.LINKEDIN_MODE = mode;
  if (configured) {
    process.env.LINKEDIN_CLIENT_ID = 'client-id';
    process.env.LINKEDIN_CLIENT_SECRET = 'client-secret';
    process.env.LINKEDIN_REDIRECT_URI = 'https://example.com/auth/linkedin/callback';
  } else {
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
    delete process.env.LINKEDIN_REDIRECT_URI;
  }
  resetEnvCache();
}

beforeEach(() => {
  resetMemoryRelationshipStore();
  resetRelationshipStoreCache();
});

afterEach(() => {
  process.env = { ...savedEnv };
  resetEnvCache();
});

describe('the copy rules', () => {
  it('"Verified direct connection" appears for exactly two states', () => {
    for (const state of RELATIONSHIP_STATES) {
      const label = RELATIONSHIP_STATE_LABEL[state];
      const sentence = warmPathSentence(state, 'Amira');
      const claimsVerified =
        /verified direct connection/i.test(label) ||
        /verified direct connection/i.test(sentence);
      expect(
        claimsVerified,
        `${state} ${claimsVerified ? 'claims' : 'does not claim'} verified-direct`,
      ).toBe(VERIFIED_DIRECT_STATES.includes(state));
    }
  });

  it('shared public context is a possible path to confirm, never "you know this person"', () => {
    const sentence = warmPathSentence('public_shared_context', 'Amira');
    expect(sentence.toLowerCase()).toContain('confirm with');
    expect(sentence.toLowerCase()).not.toContain('you know');
    expect(isWarmPath('public_shared_context')).toBe(false);
  });

  it('no confirmation verb can write an official-API state', () => {
    for (const state of Object.values(CONFIRMATION_ACTIONS)) {
      expect(state).not.toBe('official_api_verified_direct');
    }
  });
});

describe('the store enforces provenance for verified-direct states', () => {
  it('refuses a verified-direct edge with unqualified provenance', async () => {
    const store = await getRelationshipStore();
    await expect(
      store.upsert({
        employeeId: EMPLOYEE,
        contactId: CONTACT,
        state: 'employee_confirmed_direct',
        provenance: 'found the same name on a website',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    // The same state with an employee confirmation is accepted.
    const edge = await store.upsert({
      employeeId: EMPLOYEE,
      contactId: CONTACT,
      state: 'employee_confirmed_direct',
      provenance: 'employee_confirmation:Amira:2026-09-04',
      confirmedBy: EMPLOYEE,
    });
    expect(edge.state).toBe('employee_confirmed_direct');
    expect(edge.confirmedAt).toBeTruthy();
  });

  it('one edge per (employee, contact): a new answer replaces the old', async () => {
    const store = await getRelationshipStore();
    await store.upsert({
      employeeId: EMPLOYEE,
      contactId: CONTACT,
      state: 'possible_unverified',
      provenance: 'research:shared employer in public snippet',
    });
    await store.upsert({
      employeeId: EMPLOYEE,
      contactId: CONTACT,
      state: 'rejected_or_stale',
      provenance: 'employee_confirmation:Amira:2026-09-04',
      confirmedBy: EMPLOYEE,
    });
    const edges = await store.forContact(CONTACT);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.state).toBe('rejected_or_stale');
  });
});

describe('the LinkedIn capability report', () => {
  it('disabled mode: every capability false, and the note says the product works without it', async () => {
    setLinkedInEnv('disabled', false);
    const { capabilityReport } = await import('@/lib/linkedin/provider');
    const report = capabilityReport(['openid', 'profile', 'email']);
    expect(Object.values(report.capabilities).every((value) => value === false)).toBe(
      true,
    );
    expect(report.notes.join(' ')).toContain('without it');
  });

  it('openid mode: capability follows GRANTED scopes, not configuration', async () => {
    setLinkedInEnv('openid_only');
    const { capabilityReport } = await import('@/lib/linkedin/provider');

    const nothingGranted = capabilityReport([]);
    expect(nothingGranted.capabilities.authenticated_member_identity).toBe(false);

    const granted = capabilityReport(['openid', 'profile', 'email']);
    expect(granted.capabilities.authenticated_member_identity).toBe(true);
    expect(granted.capabilities.member_email).toBe(true);
  });

  it('partner capabilities stay false in every mode, and the method refuses', async () => {
    setLinkedInEnv('partner_sales_access');
    const { capabilityReport, requirePartnerCapability } =
      await import('@/lib/linkedin/provider');
    const report = capabilityReport(['openid', 'profile', 'email']);
    expect(report.capabilities.connection_export).toBe(false);
    expect(report.capabilities.messaging).toBe(false);
    expect(report.capabilities.sales_display).toBe(false);
    expect(() => requirePartnerCapability('connection_export')).toThrowError(
      /not available/,
    );
    expect(report.notes.join(' ')).toMatch(/partner/i);
  });
});

describe('the OAuth surface', () => {
  it('requests only the OpenID scopes, with PKCE S256, and no secret in the URL', () => {
    const { challenge } = generatePkce();
    const url = new URL(
      buildAuthorizationUrl({
        clientId: 'client-id',
        redirectUri: 'https://example.com/auth/linkedin/callback',
        state: generateState(),
        codeChallenge: challenge,
      }),
    );
    expect(url.origin).toBe('https://www.linkedin.com');
    expect(url.searchParams.get('scope')).toBe(OPENID_SCOPES.join(' '));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.toString()).not.toContain('secret');
  });

  it('the callback refuses a mismatched or missing state', () => {
    expect(
      validateCallback({ expectedState: 'a', receivedState: 'b', code: 'code' }),
    ).toBeNull();
    expect(
      validateCallback({ expectedState: null, receivedState: 'a', code: 'code' }),
    ).toBeNull();
    expect(
      validateCallback({ expectedState: 'a', receivedState: 'a', code: null }),
    ).toBeNull();
    expect(
      validateCallback({ expectedState: 'a', receivedState: 'a', code: 'code' }),
    ).toEqual({ code: 'code' });
  });

  it('PKCE pairs verify: the challenge is the S256 of the verifier', async () => {
    const { createHash } = await import('node:crypto');
    const { verifier, challenge } = generatePkce();
    expect(createHash('sha256').update(verifier).digest('base64url')).toBe(challenge);
  });
});
