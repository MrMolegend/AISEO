import 'server-only';
import { getEnv } from '@/lib/env';
import { PlatformError } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';
import {
  LINKEDIN_TOKEN_URL,
  LINKEDIN_USERINFO_URL,
  OPENID_SCOPES,
} from '@/lib/linkedin/oauth';

/**
 * The LinkedIn capability boundary.
 *
 * The rules this module exists to enforce:
 *
 *   · Capability comes from scopes ACTUALLY GRANTED, recorded per employee
 *     at link time — never from environment configuration alone. Setting
 *     LINKEDIN_MODE manufactures nothing.
 *   · The openid_only mode may authenticate an employee's own identity and
 *     read exactly the identity fields the granted scopes return. It may
 *     NOT enumerate connections, search members, list a company's
 *     employees, read messages, send anything, or touch Sales Navigator —
 *     and there is no code path here that could.
 *   · Partner capabilities are a named, permanently-disabled surface in
 *     this build: LinkedIn is not accepting new Sales Navigator partners,
 *     the Contacts API is restricted, and no partner scope is requested
 *     anywhere. The capability report says so in words instead of hiding
 *     the buttons.
 *   · No scraping, browser automation, cookie reuse, or unofficial
 *     endpoint exists here or anywhere else in the codebase; public
 *     LinkedIn URLs seen elsewhere arrive from a search provider's own
 *     index and are labelled public_search_index.
 *   · No access or refresh token is stored. The one access token obtained
 *     during linking lives for the duration of two server-side requests
 *     and is discarded.
 */

export type LinkedInMode = 'disabled' | 'openid_only' | 'partner_sales_access';

export interface LinkedInCapabilityReport {
  mode: LinkedInMode;
  /** Whether the mode's required credentials are configured. */
  configured: boolean;
  capabilities: {
    authenticated_member_identity: boolean;
    member_email: boolean;
    organisation_admin: boolean;
    public_profile_association: boolean;
    sales_display: boolean;
    sales_analytics: boolean;
    sales_crm_validation: boolean;
    connection_export: boolean;
    messaging: boolean;
  };
  /** Why each unavailable group is unavailable, in words for the panel. */
  notes: string[];
}

export function linkedInMode(): LinkedInMode {
  return getEnv().LINKEDIN_MODE;
}

export function linkedInConfigured(): boolean {
  const env = getEnv();
  if (env.LINKEDIN_MODE === 'disabled') return false;
  return Boolean(
    env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET && env.LINKEDIN_REDIRECT_URI,
  );
}

/**
 * The capability report, given the scopes one employee actually granted
 * (empty for "nobody linked yet" / the workspace-level view).
 */
export function capabilityReport(
  grantedScopes: readonly string[],
): LinkedInCapabilityReport {
  const mode = linkedInMode();
  const configured = linkedInConfigured();
  const has = (scope: string) =>
    mode !== 'disabled' && configured && grantedScopes.includes(scope);

  const notes: string[] = [];
  if (mode === 'disabled') {
    notes.push(
      'LinkedIn integration is switched off. Discovery, research and relationship mapping work fully without it.',
    );
  } else if (!configured) {
    notes.push(
      'The mode is set but credentials are incomplete; identity linking stays unavailable until LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_REDIRECT_URI are configured.',
    );
  }
  notes.push(
    'Connection enumeration, member search, employee lists, messaging and Sales Navigator data are partner-gated LinkedIn products. No partner scope is requested by this deployment, LinkedIn is not currently accepting new Sales Navigator platform partners, and these stay off regardless of configuration.',
  );

  return {
    mode,
    configured,
    capabilities: {
      authenticated_member_identity: has('openid') && has('profile'),
      member_email: has('email'),
      organisation_admin: false,
      public_profile_association: has('openid') && has('profile'),
      sales_display: false,
      sales_analytics: false,
      sales_crm_validation: false,
      connection_export: false,
      messaging: false,
    },
    notes,
  };
}

export interface LinkedInIdentity {
  externalId: string;
  displayName: string | null;
  email: string | null;
  grantedScopes: string[];
}

/**
 * Exchanges an authorization code for the member's identity, server-side.
 *
 * Used exactly once per link. The access token is a local variable that
 * never leaves this function; only the identity fields the granted scopes
 * returned are handed back for storage.
 */
export async function exchangeCodeForIdentity(input: {
  code: string;
  codeVerifier: string;
}): Promise<LinkedInIdentity> {
  const env = getEnv();
  if (env.LINKEDIN_MODE === 'disabled' || !linkedInConfigured()) {
    throw new PlatformError('NOT_FOUND', 'LinkedIn linking is not available');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    client_id: env.LINKEDIN_CLIENT_ID!,
    client_secret: env.LINKEDIN_CLIENT_SECRET!,
    redirect_uri: env.LINKEDIN_REDIRECT_URI!,
    code_verifier: input.codeVerifier,
  });

  const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokenResponse.ok) {
    logger.warn('linkedin.token_exchange_failed', { status: tokenResponse.status });
    throw new PlatformError('AUTH_REQUIRED', 'The LinkedIn link could not be completed');
  }
  const tokenPayload = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    scope?: string;
  } | null;
  const accessToken = tokenPayload?.access_token;
  if (!accessToken) {
    throw new PlatformError('AUTH_REQUIRED', 'The LinkedIn link could not be completed');
  }
  const grantedScopes = (tokenPayload?.scope ?? OPENID_SCOPES.join(','))
    .split(/[,\s]+/)
    .filter(Boolean);

  const userinfoResponse = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!userinfoResponse.ok) {
    throw new PlatformError('AUTH_REQUIRED', 'The LinkedIn link could not be completed');
  }
  const userinfo = (await userinfoResponse.json().catch(() => null)) as {
    sub?: string;
    name?: string;
    email?: string;
  } | null;
  if (!userinfo?.sub) {
    throw new PlatformError('AUTH_REQUIRED', 'The LinkedIn link could not be completed');
  }

  return {
    externalId: userinfo.sub,
    displayName: typeof userinfo.name === 'string' ? userinfo.name : null,
    email:
      typeof userinfo.email === 'string' && grantedScopes.includes('email')
        ? userinfo.email
        : null,
    grantedScopes,
  };
}

/**
 * The partner surface, spelled out so calling code cannot pretend.
 * Every partner method throws; there is nothing to configure that changes
 * that in this build.
 */
export function requirePartnerCapability(capability: string): never {
  throw new PlatformError(
    'NOT_FOUND',
    `LinkedIn partner capability "${capability}" is not available: no partner scope is granted to this deployment, and partner access is not part of this build.`,
  );
}
