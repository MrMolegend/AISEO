import type { BusinessModel, PricePosition } from '@/schemas/business-profile';
import type { BusinessStatus } from '@/schemas/market-entry/input';

/**
 * The profile form's value shape and its converters.
 *
 * Plain module, deliberately: the server page converts a stored record to
 * form values before handing them to the client component, and a converter
 * exported from a 'use client' file cannot be called during server render —
 * only rendered. Living here, both sides import it.
 */

export interface ProfileFormValues {
  name: string;
  websiteUrl: string;
  description: string;
  homeCountry: string | null;
  industry: string;
  offerings: string[];
  targetCustomers: string[];
  buyerRoles: string[];
  businessModel: BusinessModel | null;
  pricePositioning: PricePosition | null;
  salesChannels: string[];
  tractionStage: BusinessStatus | null;
  teamCapacity: string;
  differentiators: string[];
  constraintsNotes: string;
  goals: string[];
  knownCompetitors: string[];
  customerEvidence: string;
}

export function emptyProfileValues(): ProfileFormValues {
  return {
    name: '',
    websiteUrl: '',
    description: '',
    homeCountry: null,
    industry: '',
    offerings: [],
    targetCustomers: [],
    buyerRoles: [],
    businessModel: null,
    pricePositioning: null,
    salesChannels: [],
    tractionStage: null,
    teamCapacity: '',
    differentiators: [],
    constraintsNotes: '',
    goals: [],
    knownCompetitors: [],
    customerEvidence: '',
  };
}

/** A stored record, reshaped for the form's controlled inputs. */
export function toProfileFormValues(record: {
  name: string;
  websiteUrl: string | null;
  description: string | null;
  homeCountry: string | null;
  industry: string | null;
  offerings: string[];
  targetCustomers: string[];
  buyerRoles: string[];
  businessModel: BusinessModel | null;
  pricePositioning: PricePosition | null;
  salesChannels: string[];
  tractionStage: BusinessStatus | null;
  teamCapacity: string | null;
  differentiators: string[];
  constraintsNotes: string | null;
  goals: string[];
  knownCompetitors: string[];
  customerEvidence: string | null;
}): ProfileFormValues {
  return {
    name: record.name,
    websiteUrl: record.websiteUrl ?? '',
    description: record.description ?? '',
    homeCountry: record.homeCountry,
    industry: record.industry ?? '',
    offerings: record.offerings,
    targetCustomers: record.targetCustomers,
    buyerRoles: record.buyerRoles,
    businessModel: record.businessModel,
    pricePositioning: record.pricePositioning,
    salesChannels: record.salesChannels,
    tractionStage: record.tractionStage,
    teamCapacity: record.teamCapacity ?? '',
    differentiators: record.differentiators,
    constraintsNotes: record.constraintsNotes ?? '',
    goals: record.goals,
    knownCompetitors: record.knownCompetitors,
    customerEvidence: record.customerEvidence ?? '',
  };
}
