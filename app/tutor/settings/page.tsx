'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { AccountSettings } from '@/components/dashboard/account-settings';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';

export default function TutorSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        lead="Your account details, notifications and how the interface looks."
      />
      <AccountSettings>
        <Card>
          <CardHeader>
            <CardTitle as="h2">Teaching</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-ink-muted text-sm leading-relaxed">
              Your subjects, rate and lesson policies live on your public profile, and
              your teaching hours are set separately so you can change them without
              republishing anything.
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/tutor/profile" variant="secondary" size="sm">
                Edit public profile
              </ButtonLink>
              <ButtonLink href="/tutor/availability" variant="secondary" size="sm">
                Edit availability
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
      </AccountSettings>
    </div>
  );
}
