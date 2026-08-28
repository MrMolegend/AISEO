'use client';

import { useState } from 'react';
import { Database, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input, Toggle } from '@/components/ui/field';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';

/**
 * The settings every role shares: who you are, what you want to hear about, how
 * the interface looks, and a way back to a clean demo.
 *
 * Editing name and email is deliberately local-only — with Supabase Auth in
 * place these fields write to the profile row instead.
 */
export function AccountSettings({ children }: { children?: React.ReactNode }) {
  const { account, resetDemo } = useDemo();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(account?.firstName ?? '');
  const [lastName, setLastName] = useState(account?.lastName ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resetOpen, setResetOpen] = useState(false);

  const [lessonReminders, setLessonReminders] = useState(true);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [marketing, setMarketing] = useState(false);

  function onSave(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!firstName.trim()) found.firstName = 'Enter your first name.';
    if (!lastName.trim()) found.lastName = 'Enter your last name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      found.email = 'Enter a valid email address.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    toast({
      title: 'Details saved',
      description: 'Stored locally for this demonstration.',
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle as="h2">Your details</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSave} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" error={errors.firstName} required>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    value={firstName}
                    aria-invalid={Boolean(errors.firstName)}
                    aria-describedby={describedBy}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                )}
              </Field>
              <Field label="Last name" error={errors.lastName} required>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    value={lastName}
                    aria-invalid={Boolean(errors.lastName)}
                    aria-describedby={describedBy}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field label="Email address" error={errors.email} required>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="email"
                  value={email}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={describedBy}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </Field>
            <Button type="submit">Save changes</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Notifications</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Toggle
            checked={lessonReminders}
            onChange={setLessonReminders}
            label="Lesson reminders"
            description="A reminder the evening before and again an hour ahead."
          />
          <Toggle
            checked={messageAlerts}
            onChange={setMessageAlerts}
            label="New messages"
            description="Tell me when a tutor replies."
          />
          <Toggle
            checked={marketing}
            onChange={setMarketing}
            label="Occasional product updates"
            description="New features and subject coverage. No more than monthly."
          />
          <p className="text-ink-subtle border-line border-t pt-4 text-xs leading-relaxed">
            Email and SMS delivery are not connected in this build, so these switches
            change the preference only.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Appearance</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-ink-subtle text-sm">
            Choose a theme, or follow whatever your device is set to.
          </p>
          <ThemeToggle />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Demonstration data</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-ink-muted flex gap-2.5 text-sm leading-relaxed">
            <Database className="text-ink-subtle mt-0.5 size-4 shrink-0" aria-hidden />
            Bookings, messages, favourites and tutor applications you create are stored in
            this browser only. Nothing leaves your device and no account exists on a
            server.
          </p>
          <Button variant="secondary" onClick={() => setResetOpen(true)}>
            <RotateCcw className="size-4" aria-hidden />
            Reset demo data
          </Button>
        </CardBody>
      </Card>

      {children}

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          resetDemo();
          toast({
            title: 'Demo data reset',
            description: 'Everything is back to the seed data.',
            tone: 'info',
          });
        }}
        title="Reset the demonstration?"
        body="This clears the bookings, messages, favourites, availability changes and applications you have created, and signs you out. The seed data returns."
        confirmLabel="Reset everything"
        destructive
      />
    </div>
  );
}
