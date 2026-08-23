import { describe, expect, it } from 'vitest';
import {
  MAX_URL_LENGTH,
  validateAndNormalizeUrl,
  type UrlRejectionReason,
} from '@/lib/security/url-validator';

const ok = (input: string) => {
  const result = validateAndNormalizeUrl(input);
  if (!result.ok)
    throw new Error(`Expected "${input}" to be accepted, got ${result.reason}`);
  return result;
};

const rejected = (input: string): UrlRejectionReason => {
  const result = validateAndNormalizeUrl(input);
  if (result.ok)
    throw new Error(`Expected "${input}" to be rejected, got ${result.normalized}`);
  return result.reason;
};

describe('validateAndNormalizeUrl — acceptance', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['www.example.com', 'https://www.example.com/'],
    ['https://example.com', 'https://example.com/'],
    ['http://example.com', 'http://example.com/'],
    ['  example.com  ', 'https://example.com/'],
    ['//example.com', 'https://example.com/'],
    ['example.com/pricing', 'https://example.com/pricing'],
    ['example.co.uk', 'https://example.co.uk/'],
  ])('accepts %s and normalises to %s', (input, expected) => {
    expect(ok(input).normalized).toBe(expected);
  });

  it('lowercases the hostname but preserves path case', () => {
    const result = ok('HTTPS://Example.COM/Path/To/Page');
    expect(result.normalized).toBe('https://example.com/Path/To/Page');
    expect(result.hostname).toBe('example.com');
  });

  it('strips the fragment', () => {
    expect(ok('example.com/page#section-two').normalized).toBe(
      'https://example.com/page',
    );
  });

  it('strips a trailing dot from the hostname', () => {
    // "example.com." is a valid FQDN that would bypass naive suffix matching.
    expect(ok('https://example.com./').hostname).toBe('example.com');
  });

  it('drops the port when it is the scheme default', () => {
    expect(ok('https://example.com:443/').normalized).toBe('https://example.com/');
    expect(ok('http://example.com:80/').normalized).toBe('http://example.com/');
  });

  it('reports a display domain without the www prefix', () => {
    expect(ok('https://www.example.com').domain).toBe('example.com');
    expect(ok('https://shop.example.com').domain).toBe('shop.example.com');
  });

  it('accepts an IPv4 literal syntactically, leaving the address check to the SSRF guard', () => {
    expect(ok('http://93.184.216.34/').hostname).toBe('93.184.216.34');
  });

  it('punycodes an internationalised domain', () => {
    expect(ok('https://bücher.example').hostname).toBe('xn--bcher-kva.example');
  });
});

describe('validateAndNormalizeUrl — tracking parameter stripping', () => {
  it('removes campaign parameters so one page is one cache key', () => {
    expect(ok('example.com/?utm_source=x&utm_medium=y&utm_campaign=z').normalized).toBe(
      'https://example.com/',
    );
  });

  it.each(['fbclid', 'gclid', 'msclkid', 'igshid', 'ttclid', 'yclid', 'mc_eid'])(
    'removes %s',
    (param) => {
      expect(ok(`example.com/?${param}=abc123`).normalized).toBe('https://example.com/');
    },
  );

  it('keeps parameters that identify the page rather than the visit', () => {
    expect(ok('example.com/search?q=plumbing&utm_source=ads').normalized).toBe(
      'https://example.com/search?q=plumbing',
    );
  });

  it('sorts remaining parameters so ordering does not split the cache key', () => {
    const a = ok('example.com/?b=2&a=1').normalized;
    const b = ok('example.com/?a=1&b=2').normalized;
    expect(a).toBe(b);
  });
});

describe('validateAndNormalizeUrl — rejection', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
  ] as const)('rejects blank input %j as %s', (input, reason) => {
    expect(rejected(input)).toBe(reason);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com',
    'gopher://example.com',
    'vbscript:msgbox(1)',
  ])('rejects the unsupported scheme in %s', (input) => {
    expect(rejected(input)).toBe('unsupported-scheme');
  });

  it('does not rescue a dangerous scheme by prefixing https', () => {
    // The bug this guards: naive "add https:// if missing" turns
    // "javascript:alert(1)" into a URL that parses cleanly.
    const result = validateAndNormalizeUrl('javascript:alert(1)');
    expect(result.ok).toBe(false);
  });

  it.each(['https://user:pass@example.com', 'https://admin@example.com'])(
    'rejects credentials embedded in %s',
    (input) => {
      expect(rejected(input)).toBe('has-credentials');
    },
  );

  it.each([
    'http://example.com:22',
    'http://example.com:8080',
    'http://example.com:3306',
    'http://example.com:6379',
  ])('rejects the non-web port in %s', (input) => {
    expect(rejected(input)).toBe('unsupported-port');
  });

  it.each([
    'localhost',
    'http://localhost',
    'http://localhost.localdomain',
    'http://metadata.google.internal',
    'http://instance-data',
  ])('rejects the known-internal hostname %s', (input) => {
    expect(rejected(input)).toBe('not-public-hostname');
  });

  it.each([
    'http://printer.local',
    'http://api.internal',
    'http://site.localhost',
    'http://abcdef.onion',
    'http://foo.test',
    'http://foo.invalid',
  ])('rejects the reserved suffix in %s', (input) => {
    expect(rejected(input)).toBe('not-public-hostname');
  });

  it.each(['router', 'intranet', 'wiki', 'nas'])(
    'rejects the bare hostname %s, which would resolve on an internal network',
    (input) => {
      expect(rejected(input)).toBe('not-public-hostname');
    },
  );

  it.each(['http://example..com', 'http://.example.com', 'http://example.c0m'])(
    'rejects the malformed hostname in %s',
    (input) => {
      expect(rejected(input)).toBe('not-public-hostname');
    },
  );

  it('rejects an over-long address', () => {
    const long = `https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`;
    expect(rejected(long)).toBe('too-long');
  });
});

describe('validateAndNormalizeUrl — determinism', () => {
  it('is idempotent: normalising a normalised URL changes nothing', () => {
    const once = ok(
      'HTTPS://WWW.Example.com:443/Path?utm_source=x&b=2&a=1#frag',
    ).normalized;
    const twice = ok(once).normalized;
    expect(twice).toBe(once);
  });
});
