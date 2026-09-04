import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  previewImport,
  importTemplate,
  IMPORT_MAX_ROWS,
} from '@/lib/imports/parse';
import { neutraliseFormula } from '@/lib/export/csv';

/**
 * The import parser: RFC 4180 in, verdicts out. Values are data — a cell
 * that looks like a spreadsheet formula is imported verbatim and only
 * neutralised on the way OUT (the export layer's job, asserted here so
 * the pairing stays visible).
 */

const KNOWN = {
  segmentKeys: ['independent_pet_retail', 'veterinary_retail'],
  territoryKeys: ['AE-DU', 'AE-AZ', 'QA'],
  existingNames: new Set(['pet oasis']),
  existingDomains: new Set(['petoasis.example']),
};

describe('parseCsv', () => {
  it('handles quoted fields, embedded commas, doubled quotes and CRLF', () => {
    const rows = parseCsv('a,"b, with comma","say ""hi"""\r\nnext,,last\r\n');
    expect(rows).toEqual([
      ['a', 'b, with comma', 'say "hi"'],
      ['next', '', 'last'],
    ]);
  });

  it('drops fully empty lines rather than importing blanks', () => {
    expect(parseCsv('a\n\n\nb\n')).toEqual([['a'], ['b']]);
  });
});

describe('previewImport', () => {
  it('recognises the header, validates rows and names each problem with its line', () => {
    const text = [
      'name,segment,territory,website,notes',
      'Good Store,independent_pet_retail,AE-DU,goodstore.example,First contact',
      ',independent_pet_retail,AE-DU,,',
      'Bad Segment,warehouse_clubs,AE-DU,,',
      'Bad Territory,veterinary_retail,US-CA,,',
    ].join('\n');
    const preview = previewImport(text, KNOWN);

    expect(preview.rows).toHaveLength(4);
    expect(preview.creatable).toBe(1);
    expect(preview.errors).toBe(3);
    expect(preview.rows[1]).toMatchObject({
      line: 3,
      error: 'The name column is empty.',
    });
    expect(preview.rows[2]!.error).toContain('warehouse_clubs');
    expect(preview.rows[3]!.error).toContain('US-CA');
  });

  it('marks duplicates against existing accounts and within the file', () => {
    const text = [
      'Pet Oasis LLC,,,,',
      'Fresh Fields,,,,',
      'FRESH FIELDS TRADING,,,,',
      'Other Name,,,petoasis.example,',
    ].join('\n');
    const preview = previewImport(text, KNOWN);
    expect(preview.rows.map((row) => row.duplicate)).toEqual([true, false, true, true]);
    expect(preview.creatable).toBe(1);
    expect(preview.duplicates).toBe(3);
  });

  it('imports formula-looking values as verbatim text; export neutralises them', () => {
    const hostile = '=HYPERLINK("https://attacker.example","x")';
    const preview = previewImport(`"${hostile.replaceAll('"', '""')}",,,,\n`, KNOWN);
    expect(preview.rows[0]!.error).toBeNull();
    expect(preview.rows[0]!.name).toBe(hostile);
    // The pairing this design depends on: OUTBOUND cells are prefixed.
    expect(neutraliseFormula(hostile).startsWith("'")).toBe(true);
  });

  it('caps the row count instead of processing an unbounded file', () => {
    const text = Array.from(
      { length: IMPORT_MAX_ROWS + 50 },
      (_, i) => `Store ${i},,,,`,
    ).join('\n');
    const preview = previewImport(text, KNOWN);
    expect(preview.rows).toHaveLength(IMPORT_MAX_ROWS);
  });

  it('the shipped template parses with no errors', () => {
    const preview = previewImport(importTemplate(), {
      ...KNOWN,
      existingNames: new Set(),
      existingDomains: new Set(),
    });
    expect(preview.errors).toBe(0);
    expect(preview.creatable).toBe(2);
  });
});
