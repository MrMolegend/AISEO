import { BRAND } from '@/config/brand';
import { MARKET_ENTRY_PACKAGE_ID } from '@/config/report';
import { countryName } from '@/config/markets';
import { RESEARCH_PACKAGES, isResearchPackageId } from '@/config/packages';
import type { ResearchJobRecord, StoredPackageId } from './store';

/**
 * Naming a stored job, whichever product produced it.
 *
 * One function rather than a `getPackage()` call at every listing, because
 * there are now two eras of report in the database and only one catalogue. A
 * dashboard that called the old catalogue with a market-entry id would throw on
 * the row it was most likely to be showing.
 */
export function reportKindLabel(packageId: StoredPackageId): string {
  if (packageId === MARKET_ENTRY_PACKAGE_ID) return BRAND.defaultReportTitle;
  if (isResearchPackageId(packageId)) return RESEARCH_PACKAGES[packageId].name;
  return 'Research report';
}

/** True for a report produced by the previous product. */
export function isLegacyReport(packageId: StoredPackageId): boolean {
  return packageId !== MARKET_ENTRY_PACKAGE_ID;
}

/**
 * The market a dossier is about, for a listing row.
 *
 * Market-entry jobs store the target country's ISO code in `subjectDomain` —
 * see lib/jobs/create-job.ts, which explains why that column is reused. Legacy
 * jobs stored a website hostname there, so this returns null for them rather
 * than rendering a domain as if it were a country.
 */
export function targetMarketLabel(job: ResearchJobRecord): string | null {
  if (isLegacyReport(job.packageId)) return null;
  if (!job.subjectDomain) return null;
  return countryName(job.subjectDomain);
}
