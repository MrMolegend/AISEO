/**
 * Countries and currencies, as typed data rather than a runtime lookup.
 *
 * Two reasons this is a module and not `Intl.DisplayNames` at request time.
 * The list a user picks a target market from must be identical in the browser
 * and on the server — a country the form offered but the schema rejects is a
 * submission that fails after four stages of typing. And a report stores an ISO
 * code, so the name it renders later must come from the same table it was
 * chosen from, not from whatever ICU version the runtime happens to ship.
 *
 * Generated from ISO 3166-1 alpha-2 with UN M49 top-level regions. Names are
 * en-GB. The list is deliberately not exhaustive of every territory: it covers
 * the sovereign markets a small exporter would plausibly enter.
 */

export type Region = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania';

export interface Country {
  /** ISO 3166-1 alpha-2. Stored on the job; never a display string. */
  code: string;
  name: string;
  region: Region;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'AF', name: 'Afghanistan', region: 'Asia' },
  { code: 'AL', name: 'Albania', region: 'Europe' },
  { code: 'DZ', name: 'Algeria', region: 'Africa' },
  { code: 'AD', name: 'Andorra', region: 'Europe' },
  { code: 'AO', name: 'Angola', region: 'Africa' },
  { code: 'AG', name: 'Antigua & Barbuda', region: 'Americas' },
  { code: 'AR', name: 'Argentina', region: 'Americas' },
  { code: 'AM', name: 'Armenia', region: 'Asia' },
  { code: 'AU', name: 'Australia', region: 'Oceania' },
  { code: 'AT', name: 'Austria', region: 'Europe' },
  { code: 'AZ', name: 'Azerbaijan', region: 'Asia' },
  { code: 'BS', name: 'Bahamas', region: 'Americas' },
  { code: 'BH', name: 'Bahrain', region: 'Asia' },
  { code: 'BD', name: 'Bangladesh', region: 'Asia' },
  { code: 'BB', name: 'Barbados', region: 'Americas' },
  { code: 'BY', name: 'Belarus', region: 'Europe' },
  { code: 'BE', name: 'Belgium', region: 'Europe' },
  { code: 'BZ', name: 'Belize', region: 'Americas' },
  { code: 'BJ', name: 'Benin', region: 'Africa' },
  { code: 'BT', name: 'Bhutan', region: 'Asia' },
  { code: 'BO', name: 'Bolivia', region: 'Americas' },
  { code: 'BA', name: 'Bosnia & Herzegovina', region: 'Europe' },
  { code: 'BW', name: 'Botswana', region: 'Africa' },
  { code: 'BR', name: 'Brazil', region: 'Americas' },
  { code: 'BN', name: 'Brunei', region: 'Asia' },
  { code: 'BG', name: 'Bulgaria', region: 'Europe' },
  { code: 'BF', name: 'Burkina Faso', region: 'Africa' },
  { code: 'BI', name: 'Burundi', region: 'Africa' },
  { code: 'KH', name: 'Cambodia', region: 'Asia' },
  { code: 'CM', name: 'Cameroon', region: 'Africa' },
  { code: 'CA', name: 'Canada', region: 'Americas' },
  { code: 'CV', name: 'Cape Verde', region: 'Africa' },
  { code: 'CF', name: 'Central African Republic', region: 'Africa' },
  { code: 'TD', name: 'Chad', region: 'Africa' },
  { code: 'CL', name: 'Chile', region: 'Americas' },
  { code: 'CN', name: 'China', region: 'Asia' },
  { code: 'CO', name: 'Colombia', region: 'Americas' },
  { code: 'KM', name: 'Comoros', region: 'Africa' },
  { code: 'CG', name: 'Congo - Brazzaville', region: 'Africa' },
  { code: 'CD', name: 'Congo - Kinshasa', region: 'Africa' },
  { code: 'CR', name: 'Costa Rica', region: 'Americas' },
  { code: 'CI', name: 'Côte d’Ivoire', region: 'Africa' },
  { code: 'HR', name: 'Croatia', region: 'Europe' },
  { code: 'CU', name: 'Cuba', region: 'Americas' },
  { code: 'CY', name: 'Cyprus', region: 'Asia' },
  { code: 'CZ', name: 'Czechia', region: 'Europe' },
  { code: 'DK', name: 'Denmark', region: 'Europe' },
  { code: 'DJ', name: 'Djibouti', region: 'Africa' },
  { code: 'DM', name: 'Dominica', region: 'Americas' },
  { code: 'DO', name: 'Dominican Republic', region: 'Americas' },
  { code: 'EC', name: 'Ecuador', region: 'Americas' },
  { code: 'EG', name: 'Egypt', region: 'Africa' },
  { code: 'SV', name: 'El Salvador', region: 'Americas' },
  { code: 'GQ', name: 'Equatorial Guinea', region: 'Africa' },
  { code: 'ER', name: 'Eritrea', region: 'Africa' },
  { code: 'EE', name: 'Estonia', region: 'Europe' },
  { code: 'SZ', name: 'Eswatini', region: 'Africa' },
  { code: 'ET', name: 'Ethiopia', region: 'Africa' },
  { code: 'FJ', name: 'Fiji', region: 'Oceania' },
  { code: 'FI', name: 'Finland', region: 'Europe' },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'GA', name: 'Gabon', region: 'Africa' },
  { code: 'GM', name: 'Gambia', region: 'Africa' },
  { code: 'GE', name: 'Georgia', region: 'Asia' },
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'GH', name: 'Ghana', region: 'Africa' },
  { code: 'GR', name: 'Greece', region: 'Europe' },
  { code: 'GD', name: 'Grenada', region: 'Americas' },
  { code: 'GT', name: 'Guatemala', region: 'Americas' },
  { code: 'GN', name: 'Guinea', region: 'Africa' },
  { code: 'GW', name: 'Guinea-Bissau', region: 'Africa' },
  { code: 'GY', name: 'Guyana', region: 'Americas' },
  { code: 'HT', name: 'Haiti', region: 'Americas' },
  { code: 'HN', name: 'Honduras', region: 'Americas' },
  { code: 'HK', name: 'Hong Kong SAR China', region: 'Asia' },
  { code: 'HU', name: 'Hungary', region: 'Europe' },
  { code: 'IS', name: 'Iceland', region: 'Europe' },
  { code: 'IN', name: 'India', region: 'Asia' },
  { code: 'ID', name: 'Indonesia', region: 'Asia' },
  { code: 'IR', name: 'Iran', region: 'Asia' },
  { code: 'IQ', name: 'Iraq', region: 'Asia' },
  { code: 'IE', name: 'Ireland', region: 'Europe' },
  { code: 'IL', name: 'Israel', region: 'Asia' },
  { code: 'IT', name: 'Italy', region: 'Europe' },
  { code: 'JM', name: 'Jamaica', region: 'Americas' },
  { code: 'JP', name: 'Japan', region: 'Asia' },
  { code: 'JO', name: 'Jordan', region: 'Asia' },
  { code: 'KZ', name: 'Kazakhstan', region: 'Asia' },
  { code: 'KE', name: 'Kenya', region: 'Africa' },
  { code: 'KI', name: 'Kiribati', region: 'Oceania' },
  { code: 'XK', name: 'Kosovo', region: 'Europe' },
  { code: 'KW', name: 'Kuwait', region: 'Asia' },
  { code: 'KG', name: 'Kyrgyzstan', region: 'Asia' },
  { code: 'LA', name: 'Laos', region: 'Asia' },
  { code: 'LV', name: 'Latvia', region: 'Europe' },
  { code: 'LB', name: 'Lebanon', region: 'Asia' },
  { code: 'LS', name: 'Lesotho', region: 'Africa' },
  { code: 'LR', name: 'Liberia', region: 'Africa' },
  { code: 'LY', name: 'Libya', region: 'Africa' },
  { code: 'LI', name: 'Liechtenstein', region: 'Europe' },
  { code: 'LT', name: 'Lithuania', region: 'Europe' },
  { code: 'LU', name: 'Luxembourg', region: 'Europe' },
  { code: 'MO', name: 'Macao SAR China', region: 'Asia' },
  { code: 'MG', name: 'Madagascar', region: 'Africa' },
  { code: 'MW', name: 'Malawi', region: 'Africa' },
  { code: 'MY', name: 'Malaysia', region: 'Asia' },
  { code: 'MV', name: 'Maldives', region: 'Asia' },
  { code: 'ML', name: 'Mali', region: 'Africa' },
  { code: 'MT', name: 'Malta', region: 'Europe' },
  { code: 'MH', name: 'Marshall Islands', region: 'Oceania' },
  { code: 'MR', name: 'Mauritania', region: 'Africa' },
  { code: 'MU', name: 'Mauritius', region: 'Africa' },
  { code: 'MX', name: 'Mexico', region: 'Americas' },
  { code: 'FM', name: 'Micronesia', region: 'Oceania' },
  { code: 'MD', name: 'Moldova', region: 'Europe' },
  { code: 'MC', name: 'Monaco', region: 'Europe' },
  { code: 'MN', name: 'Mongolia', region: 'Asia' },
  { code: 'ME', name: 'Montenegro', region: 'Europe' },
  { code: 'MA', name: 'Morocco', region: 'Africa' },
  { code: 'MZ', name: 'Mozambique', region: 'Africa' },
  { code: 'MM', name: 'Myanmar (Burma)', region: 'Asia' },
  { code: 'NA', name: 'Namibia', region: 'Africa' },
  { code: 'NR', name: 'Nauru', region: 'Oceania' },
  { code: 'NP', name: 'Nepal', region: 'Asia' },
  { code: 'NL', name: 'Netherlands', region: 'Europe' },
  { code: 'NZ', name: 'New Zealand', region: 'Oceania' },
  { code: 'NI', name: 'Nicaragua', region: 'Americas' },
  { code: 'NE', name: 'Niger', region: 'Africa' },
  { code: 'NG', name: 'Nigeria', region: 'Africa' },
  { code: 'MK', name: 'North Macedonia', region: 'Europe' },
  { code: 'NO', name: 'Norway', region: 'Europe' },
  { code: 'OM', name: 'Oman', region: 'Asia' },
  { code: 'PK', name: 'Pakistan', region: 'Asia' },
  { code: 'PW', name: 'Palau', region: 'Oceania' },
  { code: 'PS', name: 'Palestinian Territories', region: 'Asia' },
  { code: 'PA', name: 'Panama', region: 'Americas' },
  { code: 'PG', name: 'Papua New Guinea', region: 'Oceania' },
  { code: 'PY', name: 'Paraguay', region: 'Americas' },
  { code: 'PE', name: 'Peru', region: 'Americas' },
  { code: 'PH', name: 'Philippines', region: 'Asia' },
  { code: 'PL', name: 'Poland', region: 'Europe' },
  { code: 'PT', name: 'Portugal', region: 'Europe' },
  { code: 'PR', name: 'Puerto Rico', region: 'Americas' },
  { code: 'QA', name: 'Qatar', region: 'Asia' },
  { code: 'RO', name: 'Romania', region: 'Europe' },
  { code: 'RU', name: 'Russia', region: 'Europe' },
  { code: 'RW', name: 'Rwanda', region: 'Africa' },
  { code: 'WS', name: 'Samoa', region: 'Oceania' },
  { code: 'SM', name: 'San Marino', region: 'Europe' },
  { code: 'ST', name: 'São Tomé & Príncipe', region: 'Africa' },
  { code: 'SA', name: 'Saudi Arabia', region: 'Asia' },
  { code: 'SN', name: 'Senegal', region: 'Africa' },
  { code: 'RS', name: 'Serbia', region: 'Europe' },
  { code: 'SC', name: 'Seychelles', region: 'Africa' },
  { code: 'SL', name: 'Sierra Leone', region: 'Africa' },
  { code: 'SG', name: 'Singapore', region: 'Asia' },
  { code: 'SK', name: 'Slovakia', region: 'Europe' },
  { code: 'SI', name: 'Slovenia', region: 'Europe' },
  { code: 'SB', name: 'Solomon Islands', region: 'Oceania' },
  { code: 'SO', name: 'Somalia', region: 'Africa' },
  { code: 'ZA', name: 'South Africa', region: 'Africa' },
  { code: 'KR', name: 'South Korea', region: 'Asia' },
  { code: 'SS', name: 'South Sudan', region: 'Africa' },
  { code: 'ES', name: 'Spain', region: 'Europe' },
  { code: 'LK', name: 'Sri Lanka', region: 'Asia' },
  { code: 'KN', name: 'St Kitts & Nevis', region: 'Americas' },
  { code: 'LC', name: 'St Lucia', region: 'Americas' },
  { code: 'VC', name: 'St Vincent & the Grenadines', region: 'Americas' },
  { code: 'SD', name: 'Sudan', region: 'Africa' },
  { code: 'SR', name: 'Suriname', region: 'Americas' },
  { code: 'SE', name: 'Sweden', region: 'Europe' },
  { code: 'CH', name: 'Switzerland', region: 'Europe' },
  { code: 'SY', name: 'Syria', region: 'Asia' },
  { code: 'TW', name: 'Taiwan', region: 'Asia' },
  { code: 'TJ', name: 'Tajikistan', region: 'Asia' },
  { code: 'TZ', name: 'Tanzania', region: 'Africa' },
  { code: 'TH', name: 'Thailand', region: 'Asia' },
  { code: 'TL', name: 'Timor-Leste', region: 'Asia' },
  { code: 'TG', name: 'Togo', region: 'Africa' },
  { code: 'TO', name: 'Tonga', region: 'Oceania' },
  { code: 'TT', name: 'Trinidad & Tobago', region: 'Americas' },
  { code: 'TN', name: 'Tunisia', region: 'Africa' },
  { code: 'TR', name: 'Türkiye', region: 'Asia' },
  { code: 'TM', name: 'Turkmenistan', region: 'Asia' },
  { code: 'TV', name: 'Tuvalu', region: 'Oceania' },
  { code: 'UG', name: 'Uganda', region: 'Africa' },
  { code: 'UA', name: 'Ukraine', region: 'Europe' },
  { code: 'AE', name: 'United Arab Emirates', region: 'Asia' },
  { code: 'GB', name: 'United Kingdom', region: 'Europe' },
  { code: 'US', name: 'United States', region: 'Americas' },
  { code: 'UY', name: 'Uruguay', region: 'Americas' },
  { code: 'UZ', name: 'Uzbekistan', region: 'Asia' },
  { code: 'VU', name: 'Vanuatu', region: 'Oceania' },
  { code: 'VA', name: 'Vatican City', region: 'Europe' },
  { code: 'VE', name: 'Venezuela', region: 'Americas' },
  { code: 'VN', name: 'Vietnam', region: 'Asia' },
  { code: 'YE', name: 'Yemen', region: 'Asia' },
  { code: 'ZM', name: 'Zambia', region: 'Africa' },
  { code: 'ZW', name: 'Zimbabwe', region: 'Africa' },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && BY_CODE.has(value);
}

export function countryName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

export function countryFor(code: string): Country | null {
  return BY_CODE.get(code) ?? null;
}

/**
 * Search, for the combobox.
 *
 * Matches on a prefix of any word in the name as well as the code, so "united"
 * finds both Kingdoms and "AE" finds the Emirates, but "ted" finds neither —
 * substring-anywhere matching makes a 199-row list feel random.
 */
export function searchCountries(query: string, limit = 12): readonly Country[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return COUNTRIES.slice(0, limit);

  const results: Country[] = [];
  for (const country of COUNTRIES) {
    const name = country.name.toLowerCase();
    const matches =
      country.code.toLowerCase() === needle ||
      name.startsWith(needle) ||
      name.split(/[\s(\-']+/).some((word) => word.startsWith(needle));
    if (matches) {
      results.push(country);
      if (results.length >= limit) break;
    }
  }
  return results;
}

/* ──────────────────────────────── Currencies ─────────────────────────────── */

export interface Currency {
  /** ISO 4217. */
  code: string;
  name: string;
  symbol: string;
}

/**
 * The currencies a small exporter actually quotes in.
 *
 * Deliberately a curated list rather than every ISO 4217 code: a dropdown of
 * 180 currencies including four that are no longer issued helps nobody, and a
 * user whose currency is missing types their figures in one that is listed and
 * says so in the notes field.
 */
export const CURRENCIES: readonly Currency[] = [
  { code: 'AED', name: 'UAE dirham', symbol: 'د.إ' },
  { code: 'AUD', name: 'Australian dollar', symbol: 'A$' },
  { code: 'BRL', name: 'Brazilian real', symbol: 'R$' },
  { code: 'CAD', name: 'Canadian dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese yuan', symbol: '¥' },
  { code: 'CZK', name: 'Czech koruna', symbol: 'Kč' },
  { code: 'DKK', name: 'Danish krone', symbol: 'kr' },
  { code: 'EGP', name: 'Egyptian pound', symbol: 'E£' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'Pound sterling', symbol: '£' },
  { code: 'HKD', name: 'Hong Kong dollar', symbol: 'HK$' },
  { code: 'IDR', name: 'Indonesian rupiah', symbol: 'Rp' },
  { code: 'ILS', name: 'Israeli new shekel', symbol: '₪' },
  { code: 'INR', name: 'Indian rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese yen', symbol: '¥' },
  { code: 'KES', name: 'Kenyan shilling', symbol: 'KSh' },
  { code: 'KRW', name: 'South Korean won', symbol: '₩' },
  { code: 'MAD', name: 'Moroccan dirham', symbol: 'DH' },
  { code: 'MXN', name: 'Mexican peso', symbol: 'MX$' },
  { code: 'MYR', name: 'Malaysian ringgit', symbol: 'RM' },
  { code: 'NGN', name: 'Nigerian naira', symbol: '₦' },
  { code: 'NOK', name: 'Norwegian krone', symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand dollar', symbol: 'NZ$' },
  { code: 'PHP', name: 'Philippine peso', symbol: '₱' },
  { code: 'PLN', name: 'Polish złoty', symbol: 'zł' },
  { code: 'QAR', name: 'Qatari riyal', symbol: 'ر.ق' },
  { code: 'RON', name: 'Romanian leu', symbol: 'lei' },
  { code: 'SAR', name: 'Saudi riyal', symbol: 'ر.س' },
  { code: 'SEK', name: 'Swedish krona', symbol: 'kr' },
  { code: 'SGD', name: 'Singapore dollar', symbol: 'S$' },
  { code: 'THB', name: 'Thai baht', symbol: '฿' },
  { code: 'TRY', name: 'Turkish lira', symbol: '₺' },
  { code: 'USD', name: 'US dollar', symbol: '$' },
  { code: 'VND', name: 'Vietnamese dong', symbol: '₫' },
  { code: 'ZAR', name: 'South African rand', symbol: 'R' },
] as const;

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && CURRENCY_BY_CODE.has(value);
}

export function currencyFor(code: string): Currency | null {
  return CURRENCY_BY_CODE.get(code) ?? null;
}

export function searchCurrencies(query: string, limit = 12): readonly Currency[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return CURRENCIES.slice(0, limit);

  return CURRENCIES.filter(
    (currency) =>
      currency.code.toLowerCase().startsWith(needle) ||
      currency.name
        .toLowerCase()
        .split(/[\s\-]+/)
        .some((word) => word.startsWith(needle)),
  ).slice(0, limit);
}

/**
 * A sensible default currency for a market.
 *
 * Only a starting value for the form — the user can always change it, and the
 * report records what they chose, not what we guessed. Markets not listed fall
 * back to nothing rather than to dollars, because a silently wrong currency on
 * a pricing page is worse than an empty one.
 */
const DEFAULT_CURRENCY_BY_COUNTRY: Readonly<Record<string, string>> = {
  AE: 'AED',
  AT: 'EUR',
  AU: 'AUD',
  BE: 'EUR',
  BR: 'BRL',
  CA: 'CAD',
  CH: 'CHF',
  CN: 'CNY',
  CY: 'EUR',
  CZ: 'CZK',
  DE: 'EUR',
  DK: 'DKK',
  EE: 'EUR',
  EG: 'EGP',
  ES: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  GB: 'GBP',
  GR: 'EUR',
  HK: 'HKD',
  ID: 'IDR',
  IE: 'EUR',
  IL: 'ILS',
  IN: 'INR',
  IT: 'EUR',
  JP: 'JPY',
  KE: 'KES',
  KR: 'KRW',
  LT: 'EUR',
  LU: 'EUR',
  LV: 'EUR',
  MA: 'MAD',
  MT: 'EUR',
  MX: 'MXN',
  MY: 'MYR',
  NG: 'NGN',
  NL: 'EUR',
  NO: 'NOK',
  NZ: 'NZD',
  PH: 'PHP',
  PL: 'PLN',
  PT: 'EUR',
  QA: 'QAR',
  RO: 'RON',
  SA: 'SAR',
  SE: 'SEK',
  SG: 'SGD',
  SI: 'EUR',
  SK: 'EUR',
  TH: 'THB',
  TR: 'TRY',
  US: 'USD',
  VN: 'VND',
  ZA: 'ZAR',
};

export function defaultCurrencyFor(countryCode: string): string | null {
  return DEFAULT_CURRENCY_BY_COUNTRY[countryCode] ?? null;
}
