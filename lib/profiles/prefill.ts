import type { BusinessProfileRecord } from '@/lib/profiles/store';

/**
 * Profile → brief prefill.
 *
 * Deliberately conservative: only fields whose meaning is identical on both
 * sides are copied, because a prefill that guesses reads as the product
 * putting words in the customer's mouth. Everything copied lands in ordinary
 * editable fields — the brief's copy is its own from the first keystroke, and
 * editing it never writes back to the profile.
 *
 * The website is NOT part of the prefill. It never enters the brief (the
 * brief has no URL field, by promise and by test); it travels with the
 * profile itself and joins the research as one optional evidence seed.
 */
export function profileToBriefDefaults(
  profile: BusinessProfileRecord,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  defaults.businessName = profile.name;
  if (profile.description) defaults.offerDescription = profile.description;
  if (profile.industry) defaults.category = profile.industry;
  if (profile.homeCountry) defaults.originCountry = profile.homeCountry;
  if (profile.tractionStage) defaults.businessStatus = profile.tractionStage;
  if (profile.offerings.length > 0) {
    defaults.productName = profile.offerings.join(', ').slice(0, 200);
  }
  if (profile.knownCompetitors.length > 0) {
    defaults.knownCompetitors = profile.knownCompetitors;
  }
  if (profile.differentiators.length > 0) {
    defaults.productCharacteristics = profile.differentiators.join('; ').slice(0, 800);
  }
  if (profile.customerEvidence) {
    defaults.additionalContext = profile.customerEvidence.slice(0, 1200);
  }

  return defaults;
}
