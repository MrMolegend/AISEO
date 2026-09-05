import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import {
  ProofPointsEditor,
  ProhibitedClaimsEditor,
  OutreachRulesEditor,
  ScoringWeightsEditor,
  BudgetCapsEditor,
} from '@/components/commercial/config-editor';
import { BrandCatalogue } from '@/components/commercial/brand-catalogue';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getAltConfigStore } from '@/lib/alt/config-store';

export const metadata: Metadata = {
  title: pageTitle('Commercial configuration'),
  robots: { index: false, follow: false },
};

/**
 * The commercial configuration.
 *
 * Everything that drives discovery, scoring and outreach as data: proof
 * points with provenance, prohibited claims, tone and signature rules,
 * scoring weights, budget caps, and the brand catalogue. super_admin and
 * sales_manager only; everyone else gets a 404.
 */
export default async function CommercialPage() {
  await requireWorkspacePage('/commercial', 'super_admin', 'sales_manager');

  const store = await getAltConfigStore();
  const [proofPoints, prohibited, outreachRules, weights, caps, brands] =
    await Promise.all([
      store.getConfig('proof_points'),
      store.getConfig('prohibited_claims'),
      store.getConfig('outreach_rules'),
      store.getConfig('scoring_weights'),
      store.getConfig('budget_caps'),
      store.listBrands({ includeInactive: true }),
    ]);

  return (
    <WorkspaceShell
      kicker="Commercial configuration"
      title="The facts the product runs on."
      intro="Territories, proof points, prohibited claims, tone, scoring weights and budget caps live here as data — not buried in prompts or code. Every fact carries its source and date; anything seeded from the build specification needs re-verifying against official ALT sources."
    >
      <ProofPointsEditor initial={proofPoints} />
      <ProhibitedClaimsEditor initial={prohibited} />
      <OutreachRulesEditor initial={outreachRules} />
      <ScoringWeightsEditor initial={weights} />
      <BudgetCapsEditor initial={caps} />
      <BrandCatalogue initial={brands} />
    </WorkspaceShell>
  );
}
