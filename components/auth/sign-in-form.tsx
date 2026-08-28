'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { DASHBOARD_HOME } from '@/lib/nav';

/**
 * Validation is real; authentication is not. A valid submission selects the
 * student demo account, which is what "sign in" means in this build.
 */
export function SignInForm() {
  const { signInAsRole } = useDemo();
  const { toast } = useToast();
  const router = useRouter();
  const next = useSearchParams().get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (!email.trim()) found.email = 'Enter the email address you signed up with.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      found.email = 'That does not look like an email address.';
    if (!password) found.password = 'Enter your password.';
    else if (password.length < 8)
      found.password = 'Passwords are at least 8 characters long.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    signInAsRole('student');
    toast({
      title: 'Signed in as Maya Bennett',
      description: 'This demonstration signs you in as a student account.',
    });
    router.push(next ?? DASHBOARD_HOME.student);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Email address" error={errors.email} required>
        {({ id, describedBy }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            value={email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        )}
      </Field>

      <Field label="Password" error={errors.password} required>
        {({ id, describedBy }) => (
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={describedBy}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
          />
        )}
      </Field>

      <Button type="submit" size="lg" block disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
