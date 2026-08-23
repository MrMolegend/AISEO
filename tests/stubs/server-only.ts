/**
 * No-op stand-in for the `server-only` package under Vitest.
 *
 * The real package deliberately throws when resolved through a client build,
 * which is exactly what Vitest's resolver does. Its guarantee is a build-time
 * one enforced by Next, so replacing it in tests loses nothing.
 */
export {};
