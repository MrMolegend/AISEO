/**
 * The local-testing escape hatch, read in exactly one place.
 *
 * Set only by the integration and end-to-end suites, which serve their own
 * fixture sites on loopback and ephemeral ports. When enabled it relaxes two
 * things and nothing else:
 *
 *   · the 80/443 port restriction in the URL validator
 *   · the loopback rejection in the SSRF guard
 *
 * Production never sets this variable, so both relaxations are unreachable
 * there. It lives in its own module so that both the intake layer and the fetch
 * layer consult the same predicate — an earlier version had it private to
 * safe-fetch, which meant intake and fetch disagreed about what was allowed.
 */
export function localTestingEnabled(): boolean {
  const flag = process.env.E2E_ALLOW_LOCAL_FETCH;
  return flag === '1' || flag === 'true';
}
