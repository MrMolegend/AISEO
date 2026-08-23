import type { NextRequest } from 'next/server';
import { leadSchema, MIN_HUMAN_FORM_MS } from '@/schemas/api';
import { getLeadStore } from '@/lib/storage';
import { clientIpFrom, getRateLimiter, hashIp } from '@/lib/security/rate-limit';
import { logger, LOG_EVENTS } from '@/lib/observability/logger';

/**
 * Lead capture.
 *
 * Spam defence is deliberately quiet: a honeypot field and a minimum
 * time-on-form. Both return success to the caller rather than an error, because
 * telling a bot precisely why it was rejected is how it learns to pass. A human
 * can never trip either.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          body: parsed.error.issues[0]?.message ?? 'Please check the form and try again.',
        },
      },
      { status: 400 },
    );
  }

  const lead = parsed.data;

  // ── Quiet spam rejection ────────────────────────────────────────────────
  if (lead.companyWebsiteUrl) {
    logger.info('lead.rejected', { reason: 'honeypot' });
    return Response.json({ ok: true }, { status: 200 });
  }

  if (lead.elapsedMs !== undefined && lead.elapsedMs < MIN_HUMAN_FORM_MS) {
    logger.info('lead.rejected', { reason: 'too_fast', elapsedMs: lead.elapsedMs });
    return Response.json({ ok: true }, { status: 200 });
  }

  // ── Rate limit ──────────────────────────────────────────────────────────
  const ip = clientIpFrom(request.headers);
  if (ip !== 'unknown') {
    const limiter = await getRateLimiter();
    const verdict = await limiter.check(`lead:${hashIp(ip)}`);
    if (!verdict.allowed) {
      return Response.json(
        { error: { body: 'Too many submissions. Please try again later.' } },
        { status: 429 },
      );
    }
  }

  try {
    const store = await getLeadStore();
    await store.create({
      auditPublicId: lead.auditPublicId ?? null,
      name: lead.name,
      email: lead.email,
      company: lead.company || null,
      website: lead.website || null,
      message: lead.message || null,
    });

    // The email itself is never logged: it is personal data, and the audit id is
    // enough to correlate the enquiry with the report it came from.
    logger.info(LOG_EVENTS.leadCaptured, { auditPublicId: lead.auditPublicId ?? null });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    logger.error('lead.store_failed', { error });
    return Response.json(
      { error: { body: 'We could not save your message. Please try again.' } },
      { status: 500 },
    );
  }
}
