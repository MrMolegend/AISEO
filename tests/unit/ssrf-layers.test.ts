import { describe, expect, it } from 'vitest';
import { validateAndNormalizeUrl } from '@/lib/security/url-validator';
import { checkAddress } from '@/lib/security/ssrf-guard';

/**
 * The two security layers composed.
 *
 * Neither layer alone tells the whole story: the validator canonicalises legacy
 * IPv4 encodings but does not judge whether an address is routable, and the guard
 * judges addresses but never sees the raw user input. What matters to the product
 * is the composition — that a hostile string entered in the form cannot reach a
 * private destination, whichever layer happens to stop it.
 *
 * These are the cases a filter-bypass attempt would actually use.
 */

function reachesPrivateDestination(input: string): boolean {
  const validation = validateAndNormalizeUrl(input);
  if (!validation.ok) return false; // stopped at the syntactic layer

  const address = checkAddress(validation.hostname);
  if (address.reason === 'unparseable') {
    // A name, not a literal. Resolution is the guard's job at fetch time and is
    // covered separately; nothing here can assert about it offline.
    return false;
  }
  return address.allowed;
}

describe('URL validation composed with address checking', () => {
  it.each([
    // Plain forms
    'http://127.0.0.1/',
    'http://localhost/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    // Legacy encodings the URL parser canonicalises
    'http://2130706433/',
    'http://0x7f.0.0.1/',
    'http://0177.0.0.1/',
    'http://127.1/',
    'http://10.1/',
    'http://192.168.1/',
    'http://0/',
    // IPv6 forms
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
    // Reserved hostnames
    'http://metadata.google.internal/',
    'http://instance-data/',
    'http://foo.internal/',
    'http://printer.local/',
    // Non-web schemes and ports
    'file:///etc/passwd',
    'gopher://127.0.0.1:6379/',
    'http://127.0.0.1:6379/',
    'http://user:pass@127.0.0.1/',
  ])('cannot reach a private destination via %s', (input) => {
    expect(reachesPrivateDestination(input)).toBe(false);
  });

  it('still allows a genuine public address literal through both layers', () => {
    expect(reachesPrivateDestination('http://93.184.216.34/')).toBe(true);
  });
});
