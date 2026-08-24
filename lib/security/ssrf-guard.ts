import 'server-only';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { PlatformError } from '@/lib/errors';
import { localTestingEnabled } from './local-testing';

/**
 * IP-level SSRF protection.
 *
 * This service fetches arbitrary user-supplied URLs from inside a cloud network,
 * which makes it a confused deputy by construction. The hostname checks in
 * url-validator.ts are a fast fail; *this* is the authoritative gate, because a
 * hostname denylist is trivially bypassed by pointing a public DNS record at a
 * private address.
 *
 * Two layers matter here and they are not interchangeable:
 *
 *   1. `assertHostnameResolvesPublicly` resolves the name and rejects private
 *      answers before a connection is attempted.
 *   2. `assertAddressIsPublic` is called again at socket-connect time against the
 *      address actually being dialled. Without that second check, an attacker
 *      serving a low-TTL record can answer the pre-flight lookup with a public
 *      address and the connect lookup with 169.254.169.254 — the classic DNS
 *      rebinding race. Checking once is a bug, not a simplification.
 */

/**
 * Non-public IPv4 ranges. `ipaddr.js` classifies most of these itself, but the
 * list is written out so the intent of each is reviewable and so a change in the
 * library's classification cannot silently widen what we allow.
 */
const BLOCKED_V4_RANGES: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // RFC1918 private
  ['100.64.0.0', 10], // RFC6598 carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local — AWS/GCP/Azure instance metadata lives here
  ['172.16.0.0', 12], // RFC1918 private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // RFC1918 private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved (includes 255.255.255.255 broadcast)
];

const BLOCKED_V6_RANGES: [string, number][] = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
  ['2001:db8::', 32], // documentation
  ['64:ff9b::', 96], // NAT64 — can be used to reach v4 private space
];

export type AddressRejection =
  'private' | 'loopback' | 'link-local' | 'reserved' | 'unparseable';

export interface AddressCheck {
  allowed: boolean;
  reason?: AddressRejection;
}

/**
 * The single decision point for "may we connect to this address?".
 *
 * IPv4-mapped and IPv4-compatible IPv6 addresses (::ffff:127.0.0.1) are unwrapped
 * before checking — otherwise loopback sails straight through a v6-only test.
 */
export function checkAddress(address: string): AddressCheck {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return { allowed: false, reason: 'unparseable' };
  }

  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      return checkAddress(v6.toIPv4Address().toString());
    }
    for (const [base, bits] of BLOCKED_V6_RANGES) {
      if (v6.match(ipaddr.parse(base) as ipaddr.IPv6, bits)) {
        return { allowed: false, reason: classifyV6(base) };
      }
    }
    return { allowed: true };
  }

  const v4 = parsed as ipaddr.IPv4;
  for (const [base, bits] of BLOCKED_V4_RANGES) {
    if (v4.match(ipaddr.parse(base) as ipaddr.IPv4, bits)) {
      return { allowed: false, reason: classifyV4(base) };
    }
  }
  return { allowed: true };
}

function classifyV4(base: string): AddressRejection {
  if (base === '127.0.0.0') return 'loopback';
  if (base === '169.254.0.0') return 'link-local';
  if (base === '10.0.0.0' || base === '172.16.0.0' || base === '192.168.0.0') {
    return 'private';
  }
  return 'reserved';
}

function classifyV6(base: string): AddressRejection {
  if (base === '::1') return 'loopback';
  if (base === 'fe80::') return 'link-local';
  if (base === 'fc00::') return 'private';
  return 'reserved';
}

/** Throws BLOCKED_URL if the address is not publicly routable. */
export function assertAddressIsPublic(address: string, context: string): void {
  // Loopback is permitted only for the local end-to-end suite, which serves its
  // own fixture site. Never reachable in production: the flag is not set there.
  if (localTestingEnabled()) {
    const parsed = ipaddr.parse(address);
    const isLoopback =
      (parsed.kind() === 'ipv4' && address.startsWith('127.')) || address === '::1';
    if (isLoopback) return;
  }

  const result = checkAddress(address);
  if (!result.allowed) {
    throw new PlatformError(
      'BLOCKED_URL',
      `Address ${address} is not publicly routable`,
      {
        context: { address, reason: result.reason, at: context },
      },
    );
  }
}

/**
 * Resolves a hostname and rejects it unless *every* answer is public.
 *
 * All records are checked, not just the first: a host with one public and one
 * private A record must be refused outright, because we do not control which one
 * the connection ultimately uses.
 */
export async function assertHostnameResolvesPublicly(
  hostname: string,
): Promise<string[]> {
  // A bare IP literal needs no resolution, but still needs checking.
  if (ipaddr.isValid(hostname)) {
    assertAddressIsPublic(hostname, 'literal');
    return [hostname];
  }

  let records: { address: string; family: number }[];
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch (cause) {
    throw new PlatformError('SITE_UNREACHABLE', `Could not resolve ${hostname}`, {
      cause,
      context: { hostname },
    });
  }

  if (records.length === 0) {
    throw new PlatformError('SITE_UNREACHABLE', `No DNS records for ${hostname}`, {
      context: { hostname },
    });
  }

  for (const record of records) {
    assertAddressIsPublic(record.address, `dns:${hostname}`);
  }

  return records.map((r) => r.address);
}
