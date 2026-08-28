import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges class names, letting later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Money is stored in pence everywhere, so no float ever reaches a total, and
 * the grouping is done by hand — `Intl.NumberFormat` output can differ between
 * Node and the browser, which React reports as a hydration failure.
 */
export function formatPence(pence: number): string {
  const whole = Math.trunc(Math.abs(pence) / 100);
  const remainder = Math.abs(pence) % 100;
  const sign = pence < 0 ? '-' : '';
  return remainder === 0
    ? `${sign}£${group(whole)}`
    : `${sign}£${group(whole)}.${remainder < 10 ? '0' : ''}${remainder}`;
}

export function formatPounds(pounds: number): string {
  return `£${group(Math.round(pounds))}`;
}

/** Thousands separators, without Intl. */
function group(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}

export function formatNumber(value: number): string {
  return group(Math.round(value));
}

/** "under an hour", "about 2 hours" — used for tutor response times. */
export function formatResponseTime(mins: number): string {
  if (mins < 60) return `${mins} minutes`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? 'about an hour' : `about ${hours} hours`;
}

export function pluralise(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

/** Stable, dependency-free id for demo records created in the browser. */
export function shortId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
