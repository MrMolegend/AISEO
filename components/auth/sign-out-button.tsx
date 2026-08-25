/**
 * Sign out.
 *
 * A form posting to a route handler, not a click handler. Three reasons, in
 * order of how much they matter:
 *
 *   1. The server revokes the session at Supabase. The previous version cleared
 *      cookies in the browser, which left the refresh token valid for anyone
 *      who had copied it.
 *   2. It works before hydration and with JavaScript disabled.
 *   3. POST, so no `<img src>` on some other page can sign a user out.
 *
 * No 'use client' — there is nothing here that needs it.
 */
export function SignOutButton() {
  return (
    <form action="/auth/sign-out" method="post">
      <button
        type="submit"
        className="border-line-strong bg-surface text-ink hover:bg-surface-subtle focus-visible:ring-brand inline-flex h-11 items-center rounded-[var(--radius-control)] border px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Sign out
      </button>
    </form>
  );
}
