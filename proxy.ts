import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/auth/proxy';

/**
 * Next 16 calls this file's export on every matching request (the convention
 * formerly known as middleware). Its only job is refreshing the Supabase
 * session — see lib/auth/proxy.ts for why route protection does not belong here.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images. Those requests carry no
     * session worth refreshing, and running on them would add a Supabase round
     * trip to every icon.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
