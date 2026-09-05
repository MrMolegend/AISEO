import { normalizeAccountName, canonicalDomain } from '@/lib/leads/normalize';

/**
 * CSV account imports: parse, validate, and say exactly what would happen.
 *
 * Pure functions — no store access — so the preview a manager reads and
 * the commit that follows are computed by the same code from the same
 * text. Every row gets a verdict: create, duplicate (of an existing
 * account or an earlier row in the same file), or an error in words that
 * name the line.
 *
 * Values are data, never code. The parser treats every cell as text; a
 * cell that begins with a formula character is imported verbatim (it is
 * only on EXPORT that formula prefixes need neutralising — see
 * lib/export/csv.ts), and nothing here evaluates, interpolates or
 * executes any of it. Bounds are enforced before validation so a
 * pathological file fails fast instead of slowly.
 */

export const IMPORT_MAX_ROWS = 500;
const MAX_CELL_LENGTH = 500;
const MAX_TEXT_LENGTH = IMPORT_MAX_ROWS * 6 * (MAX_CELL_LENGTH + 3);

/** The template's columns, in order. Only `name` is required per row. */
export const IMPORT_HEADERS = [
  'name',
  'segment',
  'territory',
  'website',
  'notes',
] as const;

/** RFC 4180: quoted fields, doubled quotes, CRLF or LF line ends. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const push = () => {
    row.push(cell.slice(0, MAX_CELL_LENGTH));
    cell = '';
  };
  const pushRow = () => {
    push();
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += character;
      }
    } else if (character === '"' && cell === '') {
      inQuotes = true;
    } else if (character === ',') {
      push();
    } else if (character === '\n') {
      pushRow();
    } else if (character !== '\r') {
      cell += character;
    }
  }
  if (cell !== '' || row.length > 0) pushRow();
  return rows;
}

export interface ImportRow {
  /** 1-based line in the pasted file, header included in the count. */
  line: number;
  name: string;
  normalizedName: string;
  segmentKey: string | null;
  territoryKey: string | null;
  websiteUrl: string | null;
  domain: string | null;
  notes: string | null;
  /** Why the row cannot be imported; null when it can. */
  error: string | null;
  /** True when an existing account (or an earlier row) already covers it. */
  duplicate: boolean;
}

export interface ImportPreview {
  rows: ImportRow[];
  creatable: number;
  duplicates: number;
  errors: number;
}

export function previewImport(
  text: string,
  known: {
    segmentKeys: readonly string[];
    territoryKeys: readonly string[];
    existingNames: ReadonlySet<string>;
    existingDomains: ReadonlySet<string>;
  },
): ImportPreview {
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      rows: [
        {
          line: 1,
          name: '',
          normalizedName: '',
          segmentKey: null,
          territoryKey: null,
          websiteUrl: null,
          domain: null,
          notes: null,
          error: `The file is too large; the limit is ${IMPORT_MAX_ROWS} rows.`,
          duplicate: false,
        },
      ],
      creatable: 0,
      duplicates: 0,
      errors: 1,
    };
  }

  // A UTF-8 BOM is presentation, not data.
  const parsed = parseCsv(text.replace(/^\uFEFF/, ''));
  if (parsed.length === 0) {
    return { rows: [], creatable: 0, duplicates: 0, errors: 0 };
  }

  // A header row is recognised, not required: pasting values alone works.
  const first = parsed[0]!.map((value) => value.trim().toLowerCase());
  const hasHeader = first[0] === 'name';
  const dataRows = hasHeader ? parsed.slice(1) : parsed;
  const lineOffset = hasHeader ? 2 : 1;

  const seenNames = new Set<string>();
  const seenDomains = new Set<string>();
  const rows: ImportRow[] = [];

  dataRows.slice(0, IMPORT_MAX_ROWS).forEach((cells, index) => {
    const [
      rawName = '',
      rawSegment = '',
      rawTerritory = '',
      rawWebsite = '',
      rawNotes = '',
    ] = cells.map((value) => value.trim());
    const line = index + lineOffset;

    const name = rawName;
    const normalizedName = normalizeAccountName(name);
    let error: string | null = null;

    if (!name) error = 'The name column is empty.';
    else if (!normalizedName) error = 'The name has no usable characters.';
    else if (name.length > 200) error = 'The name is longer than 200 characters.';

    const segmentKey = rawSegment || null;
    if (!error && segmentKey && !known.segmentKeys.includes(segmentKey)) {
      error = `Unknown segment "${segmentKey}".`;
    }
    const territoryKey = rawTerritory || null;
    if (!error && territoryKey && !known.territoryKeys.includes(territoryKey)) {
      error = `Unknown territory "${territoryKey}".`;
    }

    let websiteUrl: string | null = null;
    let domain: string | null = null;
    if (!error && rawWebsite) {
      const candidate = /^https?:\/\//i.test(rawWebsite)
        ? rawWebsite
        : `https://${rawWebsite}`;
      domain = canonicalDomain(candidate);
      if (!domain) error = `The website "${rawWebsite}" is not a usable URL.`;
      else websiteUrl = candidate;
    }

    const duplicate =
      !error &&
      (known.existingNames.has(normalizedName) ||
        seenNames.has(normalizedName) ||
        (domain !== null &&
          (known.existingDomains.has(domain) || seenDomains.has(domain))));

    if (!error) {
      seenNames.add(normalizedName);
      if (domain) seenDomains.add(domain);
    }

    rows.push({
      line,
      name,
      normalizedName,
      segmentKey,
      territoryKey,
      websiteUrl,
      domain,
      notes: rawNotes ? rawNotes.slice(0, MAX_CELL_LENGTH) : null,
      error,
      duplicate,
    });
  });

  return {
    rows,
    creatable: rows.filter((row) => !row.error && !row.duplicate).length,
    duplicates: rows.filter((row) => row.duplicate).length,
    errors: rows.filter((row) => row.error !== null).length,
  };
}

/** The downloadable template, matching what the parser reads back. */
export function importTemplate(): string {
  return [
    IMPORT_HEADERS.join(','),
    'Pet Corner Trading LLC,independent_pet_retail,AE-DU,https://example.com,Met at the trade show',
    'Desert Vets Group,veterinary_retail,AE-AZ,,',
  ].join('\r\n');
}
