'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, RadioCard } from '@/components/ui/field';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { DASHBOARD_HOME } from '@/lib/nav';
import type { Role } from '@/lib/types';

const ACCOUNT_TYPES: {
  role: Extract<Role, 'student' | 'parent' | 'tutor'>;
  title: string;
  description: string;
  icon: typeof UserRound;
}[] = [
  {
    role: 'student',
    title: 'I am the student',
    description: 'Book your own lessons and message tutors directly.',
    icon: UserRound,
  },
  {
    role: 'parent',
    title: 'I am a parent or carer',
    description: 'Link your children, book on their behalf and follow progress.',
    icon: Users,
  },
  {
    role: 'tutor',
    title: 'I want to teach',
    description: 'Apply to advertise your subjects and take bookings.',
    icon: GraduationCap,
  },
];

export function SignUpForm() {
  const { signInAsRole } = useDemo();
  const { toast } = useToast();
  const router = useRouter();

  const [role, setRole] = useState<'student' | 'parent' | 'tutor'>('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!firstName.trim()) found.firstName = 'Enter your first name.';
    if (!lastName.trim()) found.lastName = 'Enter your last name.';
    if (!email.trim()) found.email = 'Enter an email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      found.email = 'That does not look like an email address.';
    if (password.length < 8) found.password = 'Use at least 8 characters.';
    if (!agreed) found.agreed = 'Please accept the terms to continue.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    signInAsRole(role);
    if (role === 'tutor') {
      toast({
        title: 'Tutor account created',
        description: 'Next: complete your application so it can be reviewed.',
      });
      router.push('/become-a-tutor#application');
      return;
    }

    toast({
      title: 'Account created',
      description: 'You are signed into a demo account with example data.',
    });
    router.push(DASHBOARD_HOME[role]);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <fieldset>
        <legend className="text-ink mb-2.5 text-sm font-medium">
          What kind of account do you need?
        </legend>
        <div className="space-y-2.5">
          {ACCOUNT_TYPES.map((type) => (
            <RadioCard
              key={type.role}
              name="account-type"
              value={type.role}
              checked={role === type.role}
              onChange={(value) => setRole(value as typeof role)}
              title={type.title}
              description={type.description}
              icon={<type.icon className="size-5" aria-hidden />}
            />
          ))}
        </div>
        {role === 'tutor' && (
          <p className="border-info-line bg-info-bg text-info mt-3 rounded-[var(--radius-control)] border p-3 text-sm leading-relaxed">
            Tutor profiles are not published straight away. You will complete an
            application covering your subjects, qualifications and experience, and it is
            reviewed before your profile appears in search results.
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName} required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              value={firstName}
              autoComplete="given-name"
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
              autoComplete="family-name"
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
            autoComplete="email"
            value={email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>

      <Field
        label="Password"
        hint="At least 8 characters."
        error={errors.password}
        required
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            value={password}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={describedBy}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      <div>
        <Checkbox
          label="I accept the terms of use and privacy notice"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        {errors.agreed && <p className="text-danger mt-1.5 text-sm">{errors.agreed}</p>}
      </div>

      <Button type="submit" size="lg" block>
        Create account
      </Button>
    </form>
  );
}
