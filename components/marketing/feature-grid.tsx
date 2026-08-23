import {
  ClipboardList,
  Eye,
  Gauge,
  ListOrdered,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';

const FEATURES = [
  {
    icon: Gauge,
    title: 'Scores you can act on',
    detail:
      'An overall score plus six categories — technical, on-page, content, performance, mobile and UX — each with its own summary.',
  },
  {
    icon: ListOrdered,
    title: 'Ranked by what matters',
    detail:
      'Every issue carries an impact and effort rating, so the quick wins separate themselves from the long projects.',
  },
  {
    icon: ScanSearch,
    title: 'Evidence, not assertions',
    detail:
      'Each significant finding shows the actual value we read from your page, so you can verify it rather than take our word.',
  },
  {
    icon: ClipboardList,
    title: 'A real action plan',
    detail:
      'Split into what to do now, over 30 days and over 90 days, with an owner and an effort estimate on every item.',
  },
  {
    icon: Eye,
    title: 'Written to be understood',
    detail:
      'The summary is aimed at a business owner, not an SEO consultant. Jargon appears only where it is genuinely the right word.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest about its limits',
    detail:
      'Every report states plainly what it could not determine. We would rather tell you the gap than pretend we measured it.',
  },
];

export function FeatureGrid() {
  return (
    <section className="bg-surface-subtle border-line border-y">
      <div className="mx-auto max-w-[1240px] px-5 py-20 md:px-8 md:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold md:text-4xl">What you actually get</h2>
          <p className="text-ink-muted measure mt-4 text-lg leading-relaxed">
            Not a score and a shrug. A report that says what is wrong, why it costs you,
            and which thing to fix first.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardBody>
                <feature.icon className="text-brand size-5" aria-hidden />
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="text-ink-muted mt-2 text-[15px] leading-relaxed">
                  {feature.detail}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
