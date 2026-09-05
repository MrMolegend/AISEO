import { z } from 'zod';

/**
 * The role model, client-safe.
 *
 * Constants live here rather than in the server store so client components
 * can render labels without importing server-only modules — the same split
 * schemas/action-item.ts established.
 *
 * Roles are held in the team_members table, read per request on the server.
 * They are deliberately NOT trusted from the JWT: a table row changes the
 * moment an administrator edits it, while a claim waits for the token to be
 * reissued. The one exception is bootstrap — see lib/auth/membership.ts.
 */

export const ALT_ROLES = [
  'super_admin',
  'sales_manager',
  'sales_rep',
  'analyst',
  'viewer',
] as const;

export type AltRole = (typeof ALT_ROLES)[number];

export const ROLE_LABEL: Record<AltRole, string> = {
  super_admin: 'Super admin',
  sales_manager: 'Sales manager',
  sales_rep: 'Sales rep',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTION: Record<AltRole, string> = {
  super_admin:
    'Platform configuration, team and roles, provider setup, audit and repair.',
  sales_manager:
    'Territories, assignments, campaigns, team pipeline, exports and scoring configuration.',
  sales_rep:
    'Assigned leads, research, relationships, outreach drafts, notes, activities and tasks.',
  analyst: 'Research, enrichment, evidence review, scoring and campaign preparation.',
  viewer: 'Read-only authorised business visibility.',
};

/**
 * Capability groups, so authorisation reads as intent rather than a role
 * list repeated at forty call sites. A route says "who may configure the
 * platform"; the mapping here answers with roles.
 */
export const ROLES_WHO_CONFIGURE: readonly AltRole[] = ['super_admin'];
export const ROLES_WHO_MANAGE_TEAM: readonly AltRole[] = ['super_admin'];
export const ROLES_WHO_MANAGE_CAMPAIGNS: readonly AltRole[] = [
  'super_admin',
  'sales_manager',
  'analyst',
];
export const ROLES_WHO_WORK_LEADS: readonly AltRole[] = [
  'super_admin',
  'sales_manager',
  'sales_rep',
  'analyst',
];
export const ROLES_WHO_EXPORT: readonly AltRole[] = ['super_admin', 'sales_manager'];
export const ROLES_WHO_VIEW: readonly AltRole[] = [...ALT_ROLES];

export const memberInputSchema = z.object({
  userId: z.uuid({ error: 'A valid user id is required.' }),
  role: z.enum(ALT_ROLES, { error: 'Choose a role from the list.' }),
  displayName: z
    .string()
    .trim()
    .min(1, { error: 'A display name is required.' })
    .max(120, { error: 'Keep the name under 120 characters.' }),
  territories: z
    .array(z.string().trim().min(1).max(80))
    .max(30, { error: 'At most 30 territories per member.' })
    .default([]),
});

export type MemberInput = z.infer<typeof memberInputSchema>;

export const memberUpdateSchema = z.object({
  role: z.enum(ALT_ROLES).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  territories: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  status: z.enum(['active', 'revoked']).optional(),
});

export type MemberUpdate = z.infer<typeof memberUpdateSchema>;
