import { describe, expect, it } from 'vitest';
import { checkAddress } from '@/lib/security/ssrf-guard';

/**
 * These are the tests that matter most in the project. An SSRF gap here turns
 * the product into a proxy for reading cloud instance metadata, so every range
 * is asserted explicitly rather than trusting the library's own classification.
 */

const blocked = (address: string) => {
  const result = checkAddress(address);
  expect(result.allowed, `${address} should be blocked but was allowed`).toBe(false);
  return result.reason;
};

const allowed = (address: string) => {
  const result = checkAddress(address);
  expect(
    result.allowed,
    `${address} should be allowed but was blocked as ${result.reason}`,
  ).toBe(true);
};

describe('checkAddress — cloud metadata endpoints', () => {
  it.each([
    ['169.254.169.254', 'AWS / GCP / Azure instance metadata'],
    ['169.254.170.2', 'AWS ECS task metadata'],
    ['169.254.0.1', 'link-local generally'],
    ['169.254.255.255', 'link-local upper bound'],
  ])('blocks %s (%s)', (address) => {
    expect(blocked(address)).toBe('link-local');
  });

  it('blocks the Alibaba/Oracle metadata address in 100.64/10', () => {
    expect(blocked('100.100.100.200')).toBe('reserved');
  });
});

describe('checkAddress — IPv4 private and reserved ranges', () => {
  it.each(['10.0.0.0', '10.255.255.255', '10.1.2.3'])('blocks RFC1918 10/8: %s', (a) => {
    expect(blocked(a)).toBe('private');
  });

  it.each(['172.16.0.0', '172.31.255.255', '172.20.10.5'])(
    'blocks RFC1918 172.16/12: %s',
    (a) => {
      expect(blocked(a)).toBe('private');
    },
  );

  it.each(['192.168.0.0', '192.168.255.255', '192.168.1.1'])(
    'blocks RFC1918 192.168/16: %s',
    (a) => {
      expect(blocked(a)).toBe('private');
    },
  );

  it.each(['127.0.0.1', '127.0.0.0', '127.255.255.255', '127.1.2.3'])(
    'blocks loopback: %s',
    (a) => {
      expect(blocked(a)).toBe('loopback');
    },
  );

  it.each([
    '0.0.0.0',
    '0.1.2.3',
    '100.64.0.1',
    '192.0.0.1',
    '192.0.2.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '239.255.255.255',
    '240.0.0.1',
    '255.255.255.255',
  ])('blocks reserved range member %s', (a) => {
    expect(blocked(a)).toBe('reserved');
  });

  it('does not over-block addresses adjacent to private ranges', () => {
    // 172.15/172.32 sit either side of the 172.16/12 block, and 11.x is outside 10/8.
    allowed('9.255.255.255');
    allowed('11.0.0.0');
    allowed('172.15.255.255');
    allowed('172.32.0.0');
    allowed('192.167.255.255');
    allowed('192.169.0.0');
    allowed('100.63.255.255');
    allowed('100.128.0.0');
  });

  it('allows genuine public addresses', () => {
    allowed('93.184.216.34'); // example.com
    allowed('8.8.8.8');
    allowed('1.1.1.1');
    allowed('142.250.187.206');
  });
});

describe('checkAddress — IPv6', () => {
  it.each(['::1'])('blocks loopback %s', (a) => {
    expect(blocked(a)).toBe('loopback');
  });

  it('blocks the unspecified address', () => {
    expect(blocked('::')).toBe('reserved');
  });

  it.each(['fc00::1', 'fd00::1', 'fdff:ffff::1'])('blocks unique-local %s', (a) => {
    expect(blocked(a)).toBe('private');
  });

  it.each(['fe80::1', 'febf::1'])('blocks link-local %s', (a) => {
    expect(blocked(a)).toBe('link-local');
  });

  it.each(['ff02::1', 'ff00::1'])('blocks multicast %s', (a) => {
    expect(blocked(a)).toBe('reserved');
  });

  it('blocks the documentation range', () => {
    expect(blocked('2001:db8::1')).toBe('reserved');
  });

  it('blocks NAT64, which can otherwise tunnel to private IPv4 space', () => {
    expect(blocked('64:ff9b::1')).toBe('reserved');
  });

  it('allows public IPv6', () => {
    allowed('2606:2800:220:1:248:1893:25c8:1946'); // example.com
    allowed('2001:4860:4860::8888'); // Google DNS
  });
});

describe('checkAddress — IPv4-mapped IPv6 bypass', () => {
  /**
   * The bypass this guards: a v6-only range check waves ::ffff:127.0.0.1
   * straight through because it matches no v6 blocklist entry, while the OS
   * connects it to plain 127.0.0.1.
   */
  it.each([
    ['::ffff:127.0.0.1', 'loopback'],
    ['::ffff:169.254.169.254', 'link-local'],
    ['::ffff:10.0.0.1', 'private'],
    ['::ffff:192.168.1.1', 'private'],
    ['::ffff:172.16.0.1', 'private'],
  ] as const)('unwraps and blocks %s as %s', (address, reason) => {
    expect(blocked(address)).toBe(reason);
  });

  it('still allows a mapped public address', () => {
    allowed('::ffff:93.184.216.34');
  });
});

describe('checkAddress — malformed input', () => {
  it.each([
    '',
    'not-an-address',
    '999.999.999.999',
    '127.0.0.256',
    '::gggg',
    'javascript:alert(1)',
  ])('rejects unparseable input %j', (a) => {
    expect(blocked(a)).toBe('unparseable');
  });
});

describe('checkAddress — legacy IPv4 encodings', () => {
  /**
   * The classic SSRF filter bypass: naive filters compare against the string
   * "127.0.0.1", so an attacker submits the same address in decimal, octal, hex
   * or short form and walks straight past. What matters is not which reason is
   * reported but that every encoding of a private destination is refused.
   */
  it.each([
    ['2130706433', 'decimal loopback'],
    ['0x7f.0.0.1', 'hex-leading loopback'],
    ['0177.0.0.1', 'octal-leading loopback'],
    ['127.1', 'short-form loopback'],
    ['10.1', 'short-form RFC1918'],
    ['192.168.1', 'short-form RFC1918'],
    ['0', 'zero address'],
  ])('blocks %s (%s)', (address) => {
    expect(checkAddress(address).allowed).toBe(false);
  });

  it('expands three-part shorthand correctly rather than mis-parsing it', () => {
    // "1.2.3" is legacy shorthand for 1.2.0.3, which is genuinely public. The
    // point is that the expansion is applied before the range check, not after.
    allowed('1.2.3');
  });
});
