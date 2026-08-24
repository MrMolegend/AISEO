import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Citations } from './citation';
import { ClaimList, ValueWithBasis, ScorePill } from './claim';
import { ConfidenceBadge } from '@/components/ui/confidence-badge';
import { scoreBandFor } from '@/prompts/research';
import type { Competitor, CompanyLead, Creator } from '@/schemas/research/packages';
import type {
  BusinessProfile,
  ContactRoute,
  EvidencedClaim,
  ResearchAction,
  StoredSource,
} from '@/schemas/research/shared';

/**
 * The report's section renderers.
 *
 * Server Components throughout — none of this needs interactivity, and rendering
 * it on the server means a shared link is a complete page rather than a
 * spinner. The only client component in a report is the list filter.
 *
 * Every one of these takes `sources` and passes it down, because every factual
 * line ends in a citation. That threading is deliberate friction: a section that
 * forgot to accept sources would be a section that could not cite, and it would
 * not compile.
 */

export function BusinessProfileSection({
  business,
  sources,
}: {
  business: BusinessProfile;
  sources: readonly StoredSource[];
}) {
  return (
    <Card>
      <CardBody>
        <h2 className="text-ink text-lg font-semibold">What we understood</h2>

        <dl className="mt-4 space-y-4">
          <Detail label="What they sell">
            {business.whatTheySell}
            <Citations refs={business.sources} sources={sources} />
          </Detail>
          <Detail label="Audience">{business.audience}</Detail>
          <Detail label="Positioning">{business.positioning}</Detail>
        </dl>

        {business.scaleSignals.length > 0 && (
          <div className="border-line mt-5 border-t pt-5">
            <h3 className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
              Signals of scale
            </h3>
            <ClaimList
              claims={business.scaleSignals}
              sources={sources}
              className="mt-3 space-y-3"
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function CompetitorSection({
  competitors,
  sources,
}: {
  competitors: readonly Competitor[];
  sources: readonly StoredSource[];
}) {
  return (
    <div className="space-y-4">
      {competitors.map((competitor) => (
        <Card key={competitor.id} id={`competitor-${competitor.id}`}>
          <CardBody>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-ink flex flex-wrap items-center gap-2 text-[17px] font-semibold">
                  <span className="text-ink-faint tabular-nums">{competitor.rank}.</span>
                  {competitor.name}
                  <Badge
                    tone={competitor.type === 'direct' ? 'brand' : 'neutral'}
                    size="sm"
                  >
                    {competitor.type === 'direct' ? 'Direct' : 'Indirect'}
                  </Badge>
                </h3>
                <a
                  href={competitor.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-ink-subtle hover:text-brand focus-visible:ring-brand mt-1 inline-block rounded text-sm break-all underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {competitor.website}
                </a>
              </div>
              <ConfidenceBadge confidence={competitor.confidence} size="md" />
            </div>

            <p className="text-ink-muted mt-3 text-sm leading-relaxed">
              {competitor.whyRanked}
              <Citations refs={competitor.sources} sources={sources} />
            </p>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail label="Offering">{competitor.offering}</Detail>
              <Detail label="Audience">{competitor.audience}</Detail>
              <Detail label="Positioning">{competitor.positioning}</Detail>
              <Detail label="Marketing message">{competitor.marketingMessage}</Detail>
              <ValueWithBasis
                label="Pricing"
                value={competitor.pricing}
                sources={sources}
              />
            </dl>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <ClaimGroup
                title="Strengths"
                claims={competitor.strengths}
                sources={sources}
              />
              <ClaimGroup
                title="Weaknesses"
                claims={competitor.weaknesses}
                sources={sources}
              />
              <ClaimGroup
                title="Trust signals"
                claims={competitor.trustSignals}
                sources={sources}
              />
              <ClaimGroup
                title="Review themes"
                claims={competitor.reviewThemes}
                sources={sources}
              />
            </div>

            <div className="border-line bg-surface-subtle mt-5 rounded-[var(--radius-control)] border p-4">
              <h4 className="text-ink text-sm font-semibold">Battlecard</h4>
              <dl className="mt-3 space-y-3">
                <Detail label="Their pitch">{competitor.battlecard.theirPitch}</Detail>
                <Detail label="Where they win">
                  {competitor.battlecard.whereTheyWin}
                </Detail>
                <Detail label="Where you win">{competitor.battlecard.whereYouWin}</Detail>
                <Detail label="Objection to expect">
                  {competitor.battlecard.objectionToExpect}
                </Detail>
                <Detail label="Your response">
                  {competitor.battlecard.yourResponse}
                </Detail>
              </dl>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export function LeadCard({
  lead,
  sources,
}: {
  lead: CompanyLead;
  sources: readonly StoredSource[];
}) {
  const band = scoreBandFor(lead.fitScore);

  return (
    <Card id={`lead-${lead.id}`}>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-ink text-[17px] font-semibold">
              <span className="text-ink-faint tabular-nums">{lead.rank}.</span>{' '}
              {lead.name}
            </h3>
            <p className="text-ink-subtle mt-1 text-sm">
              {[lead.industry, lead.location].filter(Boolean).join(' · ')}
            </p>
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-ink-subtle hover:text-brand focus-visible:ring-brand mt-1 inline-block rounded text-sm break-all underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {lead.website}
            </a>
          </div>

          <div className="text-right">
            <ScorePill score={lead.fitScore} band={band.label} />
            <div className="mt-1.5">
              <ConfidenceBadge confidence={lead.confidence} />
            </div>
          </div>
        </div>

        <p className="text-ink-muted mt-3 text-sm leading-relaxed">
          {lead.publicDescription}
          <Citations refs={lead.sources} sources={sources} />
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <ClaimGroup title="Why they fit" claims={lead.fitEvidence} sources={sources} />
          <ClaimGroup
            title="Possible needs"
            claims={lead.likelyNeeds}
            sources={sources}
          />
        </div>

        <div className="border-line mt-5 border-t pt-5">
          <dl className="space-y-3">
            <Detail label="What to pitch">{lead.recommendedPitch}</Detail>
            <Detail label="Opening line">{lead.openingLine}</Detail>
          </dl>

          <details className="mt-4">
            <summary className="text-brand hover:text-brand-hover focus-visible:ring-brand marker:text-ink-faint cursor-pointer rounded text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">
              Outreach drafts
            </summary>
            <div className="mt-3 space-y-4">
              <Draft label="Email" body={lead.emailDraft} />
              <Draft label="LinkedIn" body={lead.linkedinMessage} />
              {lead.shortMessage && (
                <Draft label="Short message" body={lead.shortMessage} />
              )}
            </div>
          </details>

          <ContactRow contact={lead.contact} sources={sources} />
        </div>
      </CardBody>
    </Card>
  );
}

export function CreatorCard({
  creator,
  sources,
}: {
  creator: Creator;
  sources: readonly StoredSource[];
}) {
  const band = scoreBandFor(creator.brandFitScore);

  return (
    <Card id={`creator-${creator.id}`}>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-ink flex flex-wrap items-center gap-2 text-[17px] font-semibold">
              <span className="text-ink-faint tabular-nums">{creator.rank}.</span>
              {creator.name}
              <Badge tone="neutral" size="sm">
                {creator.platform}
              </Badge>
            </h3>
            <p className="text-ink-subtle mt-1 text-sm">{creator.niche}</p>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {creator.profileUrls.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-ink-subtle hover:text-brand focus-visible:ring-brand rounded text-sm break-all underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {shortenUrl(url)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-right">
            <ScorePill score={creator.brandFitScore} band={band.label} />
            <div className="mt-1.5">
              <ConfidenceBadge confidence={creator.confidence} />
            </div>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <ValueWithBasis
            label="Audience size"
            value={creator.audienceSize}
            sources={sources}
          />
          <ValueWithBasis label="Location" value={creator.location} sources={sources} />
        </dl>

        <dl className="mt-5 space-y-3">
          <Detail label="Audience fit">{creator.audienceFit}</Detail>
          <Detail label="Content style">{creator.contentStyle}</Detail>
          <Detail label="Campaign concept">{creator.campaignConcept}</Detail>
          <Detail label="Suggested deliverable">{creator.suggestedDeliverable}</Detail>
          <Detail label="Compensation approach">{creator.compensationApproach}</Detail>
          {creator.brandSafetyNotes && (
            <Detail label="Brand safety">{creator.brandSafetyNotes}</Detail>
          )}
        </dl>

        <div className="border-line mt-5 border-t pt-5">
          <ClaimGroup title="Evidence" claims={creator.evidence} sources={sources} />

          <details className="mt-4">
            <summary className="text-brand hover:text-brand-hover focus-visible:ring-brand marker:text-ink-faint cursor-pointer rounded text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">
              Outreach message
            </summary>
            <div className="mt-3 space-y-4">
              <Draft label="Opening line" body={creator.openingLine} />
              <Draft label="Full message" body={creator.outreachMessage} />
            </div>
          </details>

          <ContactRow contact={creator.contact} sources={sources} />
        </div>
      </CardBody>
    </Card>
  );
}

export function ActionList({ actions }: { actions: readonly ResearchAction[] }) {
  if (actions.length === 0) return null;

  return (
    <ol className="space-y-3">
      {actions.map((action, index) => (
        <li key={`${action.title}-${index}`}>
          <Card>
            <CardBody className="p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-ink text-[15px] font-semibold">
                  <span className="text-ink-faint tabular-nums">{index + 1}.</span>{' '}
                  {action.title}
                </h3>
                <span className="flex flex-wrap gap-1.5">
                  <Badge tone="neutral" size="sm">
                    {action.effort} effort
                  </Badge>
                  <Badge tone={action.impact === 'high' ? 'brand' : 'neutral'} size="sm">
                    {action.impact} impact
                  </Badge>
                  <Badge tone="neutral" size="sm">
                    {action.owner}
                  </Badge>
                </span>
              </div>
              <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                {action.detail}
              </p>
            </CardBody>
          </Card>
        </li>
      ))}
    </ol>
  );
}

/* ─────────────────────────────── Helpers ───────────────────────────────── */

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-ink-muted mt-1 text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

function ClaimGroup({
  title,
  claims,
  sources,
}: {
  title: string;
  claims: readonly EvidencedClaim[];
  sources: readonly StoredSource[];
}) {
  if (claims.length === 0) return null;
  return (
    <div>
      <h4 className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
        {title}
      </h4>
      <ClaimList claims={claims} sources={sources} className="mt-2.5 space-y-3" />
    </div>
  );
}

/**
 * A ready-to-send message.
 *
 * Rendered in a monospace block so what you see is what you copy — proportional
 * text hides double spaces and stray line breaks that then turn up in a real
 * email.
 */
function Draft({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <pre className="border-line bg-surface-sunken text-ink-muted mt-1.5 overflow-x-auto rounded-[var(--radius-control)] border p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
        {body}
      </pre>
    </div>
  );
}

/**
 * How to get in touch.
 *
 * Shows a contact page by preference and an address only where one was
 * published. When there is neither, it says so rather than rendering an empty
 * row — "no public contact route found" is information.
 */
function ContactRow({
  contact,
  sources,
}: {
  contact: ContactRoute;
  sources: readonly StoredSource[];
}) {
  const hasSomething = contact.contactPageUrl || contact.publishedEmail;

  return (
    <p className="text-ink-subtle mt-4 text-sm">
      <span className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
        Contact
      </span>
      <br />
      {hasSomething ? (
        <>
          {contact.contactPageUrl && (
            <a
              href={contact.contactPageUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-brand focus-visible:ring-brand rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              Contact page
            </a>
          )}
          {contact.contactPageUrl && contact.publishedEmail && ' · '}
          {contact.publishedEmail && (
            <a
              href={`mailto:${contact.publishedEmail}`}
              className="text-brand focus-visible:ring-brand rounded break-all underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              {contact.publishedEmail}
            </a>
          )}
          <Citations refs={contact.sources} sources={sources} />
        </>
      ) : (
        <span className="text-ink-faint italic">
          No public contact route found. We do not guess addresses.
        </span>
      )}
    </p>
  );
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}
