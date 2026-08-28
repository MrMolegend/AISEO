'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { AccountSettings } from '@/components/dashboard/account-settings';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';

export default function ParentSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        lead="Your details, notifications and what you can see about your learners."
      />
      <AccountSettings>
        <Card>
          <CardHeader>
            <CardTitle as="h2">Learner access</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-ink-muted text-sm leading-relaxed">
              Your view of a learner’s lessons, tutors and feedback comes from an
              authorised parent–learner link. Older learners can hold their own account
              and keep their messages private while you retain oversight of bookings and
              spending.
            </p>
            <ButtonLink href="/parent/learners" variant="secondary" size="sm">
              Manage learners
            </ButtonLink>
          </CardBody>
        </Card>
      </AccountSettings>
    </div>
  );
}
