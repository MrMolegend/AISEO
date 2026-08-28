import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { HeroSearch } from '@/components/home/hero-search';
import { ProductPreview } from '@/components/home/product-preview';
import {
  ClosingPanel,
  HowItWorksSteps,
  Section,
  SubjectGrid,
  TrustGrid,
} from '@/components/home/sections';
import { RoleTabs } from '@/components/home/role-tabs';
import { FeaturedTutors } from '@/components/home/featured-tutors';
import { getFeaturedTutors, getPopularSubjects, getSubjects } from '@/lib/queries';

export default function HomePage() {
  const subjects = getSubjects();
  const popular = getPopularSubjects();
  const featured = getFeaturedTutors(6);

  return (
    <>
      <section className="surface-hero">
        <div className="container-page grid gap-12 pt-12 pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:pt-20 lg:pb-24">
          <div>
            <Reveal>
              <p className="text-brand-ink bg-surface border-brand-line inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium">
                <ShieldCheck className="size-4" aria-hidden />
                Applications reviewed before a tutor appears
              </p>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-5 text-[2.25rem] leading-[1.08] tracking-[var(--tracking-display)] sm:text-[2.75rem] lg:text-[3.25rem]">
                Find the right tutor.
                <span className="text-brand block">Make progress that lasts.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="text-ink-muted mt-5 max-w-xl text-[1.0625rem] leading-relaxed">
                Compare tutors for GCSE, A-Level, university and adult study — with their
                qualifications, rates and real availability in front of you. Book a time
                that fits, then learn in Tutor Hub’s own lesson room.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-7">
                <HeroSearch subjects={subjects} />
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <ButtonLink href="/become-a-tutor" variant="secondary">
                  Become a tutor
                </ButtonLink>
                <p className="text-ink-subtle text-sm">
                  Reviews come only from completed lessons.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <ProductPreview />
          </Reveal>
        </div>
      </section>

      <Section
        eyebrow="Popular subjects"
        title="Start with the subject you need"
        lead="Ten of the subjects students search for most. Each one opens the marketplace with the filter already applied."
        action={
          <ButtonLink href="/tutors" variant="ghost" className="shrink-0">
            All subjects
            <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        }
      >
        <SubjectGrid subjects={popular} />
      </Section>

      <Section
        eyebrow="Featured tutors"
        title="Tutors students book again"
        lead="A cross-section of the marketplace — different subjects, rates and levels of experience. Rates are set by tutors themselves."
        action={
          <ButtonLink href="/tutors" variant="secondary" className="shrink-0">
            See all tutors
          </ButtonLink>
        }
      >
        <FeaturedTutors fallback={featured} />
      </Section>

      <div className="bg-surface border-line border-y">
        <Section
          id="how-it-works"
          eyebrow="How it works"
          title="Four steps from searching to seeing a difference"
          lead="No agency in the middle, no phone calls to arrange a trial. You choose the tutor and the time."
        >
          <HowItWorksSteps />
        </Section>
      </div>

      <Section
        eyebrow="Built for"
        title="Students, parents and tutors each get their own view"
        lead="The same lessons, seen from three sides — with parents given oversight rather than a copy of their child’s account."
      >
        <RoleTabs />
      </Section>

      <div className="bg-surface border-line border-y">
        <Section
          id="trust"
          eyebrow="Trust and safety"
          title="How Tutor Hub is designed to keep lessons safe"
          lead="These are the safeguards the platform is built around. Where a check is not yet live in this build, we say so rather than implying otherwise."
        >
          <TrustGrid />
        </Section>
      </div>

      <div className="pt-16 sm:pt-20">
        <ClosingPanel />
      </div>
    </>
  );
}
