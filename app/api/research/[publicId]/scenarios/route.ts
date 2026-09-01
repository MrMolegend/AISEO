import { requireUser } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getReportScenarioStore } from '@/lib/scenarios/store';
import { scenarioAssumptionsSchema } from '@/schemas/market-entry/scenario-lab';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * Saved Scenario Lab what-ifs for one report.
 *
 * The job is resolved through the owner-filtered read, so every verb below is
 * implicitly "on a report that is yours" — anyone else's public id, or a
 * report that never completed, is the same NOT_FOUND. Stored assumptions are
 * re-validated on the way in; results are never stored at all.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ownedJobId(publicId: string, userId: string): Promise<string> {
  const store = await getResearchJobStore();
  const job = await store.getForUser(publicId, userId);
  if (!job || job.status !== 'complete' || job.packageId !== 'market-entry') {
    throw new PlatformError('NOT_FOUND', 'No such report');
  }
  return job.id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const user = await requireUser();
    const { publicId } = await params;
    const jobId = await ownedJobId(publicId, user.id);

    const scenarios = await (await getReportScenarioStore()).listForJob(user.id, jobId);
    return jsonResponse({ scenarios });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const user = await requireUser();
    const { publicId } = await params;

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`scenario-save:${user.id}`, 60, 3_600));

    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      assumptions?: unknown;
    } | null;

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 80) {
      throw new PlatformError('INVALID_INPUT', 'Give the scenario a name', {
        context: {
          issues: [{ field: 'name', message: 'A name up to 80 characters' }],
        },
      });
    }

    const assumptions = scenarioAssumptionsSchema.safeParse(body?.assumptions);
    if (!assumptions.success) {
      throw new PlatformError('INVALID_INPUT', 'Scenario assumptions did not validate', {
        context: {
          issues: assumptions.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    const jobId = await ownedJobId(publicId, user.id);
    const scenario = await (
      await getReportScenarioStore()
    ).upsert(user.id, jobId, name, assumptions.data);
    return jsonResponse({ scenario }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const user = await requireUser();
    const { publicId } = await params;
    // The job read proves ownership of the report before any delete runs.
    await ownedJobId(publicId, user.id);

    const id = new URL(request.url).searchParams.get('id') ?? '';
    const deleted = await (await getReportScenarioStore()).delete(id, user.id);
    if (!deleted) throw new PlatformError('NOT_FOUND', 'No such scenario');
    return jsonResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
