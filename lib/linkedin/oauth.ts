import { createHash, randomBytes } from 'node:crypto';

/**
 * OAuth mechanics for the LinkedIn identity link — pure functions, so the
 * state, PKCE and URL construction are testable without a network.
 *
 * The flow is authorization-code with PKCE and an opaque state value, both
 * generated server-side and carried in a short-lived HttpOnly cookie. The
 * client secret participates only in the server-to-server exchange; nothing
 * secret ever appears in a URL or reaches a browser.
 */

export const LINKEDIN_AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

/** The only scopes the openid_only mode ever requests. */
export const OPENID_SCOPES = ['openid', 'profile', 'email'] as const;

export function generateState(): string {
  return randomBytes(24).toString('base64url');
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function generatePkce(): PkcePair {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(LINKEDIN_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  url.searchParams.set('scope', OPENID_SCOPES.join(' '));
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/**
 * Validates the callback half of the dance: the state must match the
 * cookie's exactly (timing is not a concern for a single-use random value
 * compared after the attacker has already had to obtain it), and a code
 * must be present. Returns null rather than throwing — the caller turns
 * null into one generic failure redirect that leaks nothing.
 */
export function validateCallback(input: {
  expectedState: string | null;
  receivedState: string | null;
  code: string | null;
}): { code: string } | null {
  if (!input.expectedState || !input.receivedState) return null;
  if (input.expectedState !== input.receivedState) return null;
  if (!input.code || input.code.length === 0 || input.code.length > 2048) return null;
  return { code: input.code };
}
