'use client';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client. Authentication only.
 *
 * This client holds the publishable key, which is public by design. It is used
 * to send a magic link and to sign out — never to read application data. Every
 * table in this project has RLS enabled with zero policies and no grants to
 * anon or authenticated, so a query from here would return nothing even if one
 * were written. Application data comes from this app's own server routes, where
 * the user's identity has already been verified.
 *
 * createBrowserClient is a singleton internally, so calling this repeatedly is
 * cheap and returns the same instance.
 */
export function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase auth is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    );
  }

  return createBrowserClient(url, key);
}

/** Whether sign-in is available at all, for rendering a friendly logged-out state. */
export function authConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
