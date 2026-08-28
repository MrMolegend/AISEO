import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Clock4, LifeBuoy, ShieldAlert } from 'lucide-react';
import { ContactForm } from '@/components/marketing/contact-form';
import { Card, CardBody } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the Tutor Hub team about a booking, an application or a safeguarding concern.',
};

export default function ContactPage() {
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14">
        <div>
          <h1 className="text-[2rem] tracking-[var(--tracking-display)]">Contact us</h1>
          <p className="text-ink-muted mt-3 leading-relaxed">
            Questions about a lesson, an application or how Tutor Hub works. If your
            message concerns a specific booking, include the reference so we can find it
            quickly.
          </p>

          <div className="mt-8">
            <ContactForm />
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <CardBody className="flex gap-3.5">
              <span className="bg-brand-subtle text-brand flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
                <Clock4 className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-semibold">When we reply</h2>
                <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
                  Monday to Friday, 09:00 to 18:00. Most messages get an answer the same
                  working day; anything about a lesson happening today is prioritised.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex gap-3.5">
              <span className="bg-mint text-mint-ink flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
                <LifeBuoy className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-semibold">Already have an account?</h2>
                <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
                  Reporting a problem from inside a lesson or a message thread gives us
                  the context automatically, which is usually faster than this form.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card className="border-warning-line bg-warning-bg">
            <CardBody className="flex gap-3.5">
              <span className="text-warning flex size-10 shrink-0 items-center justify-center">
                <ShieldAlert className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-ink text-base font-semibold">
                  Safeguarding concerns
                </h2>
                <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
                  Anything involving the welfare of a child or young person is escalated
                  immediately rather than queued. Read the{' '}
                  <Link href="/safeguarding" className="text-brand hover:underline">
                    safeguarding approach
                  </Link>{' '}
                  for what happens next.
                </p>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  If someone is in immediate danger, contact the emergency services first.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card className="border-dashed">
            <CardBody className="flex gap-3.5">
              <span className="text-ink-subtle flex size-10 shrink-0 items-center justify-center">
                <AlertTriangle className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-semibold">About this build</h2>
                <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
                  This is a frontend demonstration. The form validates properly but no
                  email is sent, and the contact addresses shown in the admin settings are
                  placeholders.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
