import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Session refresh, run on every matching request.
 *
 * Server Components cannot write cookies, so without this the access token
 * would expire and users would appear to be randomly signed out. Refreshing
 * here means the rest of the application can read a valid session without each
 * page trying to refresh it and racing the others.
 *
 * Three things the shape of this function is load-bearing about:
 *
 *   · Nothing runs between creating the client and calling getClaims(). A
 *     statement slipped in between is the classic way to break refresh in a way
 *     that only shows up as intermittent sign-outs.
 *   · The response returned is the one the client wrote its cookies onto. A
 *     fresh NextResponse would silently drop the refreshed token and put the
 *     browser and server permanently out of step.
 *   · The cache headers Supabase supplies are copied onto the response. Without
 *     them a CDN can cache a response containing one person's session and serve
 *     it to somebody else.
 *
 * Route protection is deliberately not done here. Middleware sees the cookie,
 * not a verified identity, and a page that redirects on that basis has trusted
 * the browser. Pages call requireUser() themselves.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without credentials there is no session to refresh, and the site should
  // still serve its public pages.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [header, value] of Object.entries(headers)) {
          response.headers.set(header, value);
        }
      },
    },
  });

  try {
    await supabase.auth.getClaims();
  } catch {
    // A refresh failure is a signed-out user on the next request, not a 500 on
    // this one.
  }

  return response;
}
