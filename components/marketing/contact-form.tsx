'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/lib/store/toast';

const TOPICS = [
  'Finding a tutor',
  'A booking or a lesson',
  'Becoming a tutor',
  'Billing',
  'Safeguarding concern',
  'Something else',
];

/**
 * Validation runs locally; nothing is sent. An email service is one of the four
 * integrations this build deliberately leaves unconnected.
 */
export function ContactForm() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState(TOPICS[0] ?? 'Something else');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = 'Tell us your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      found.email = 'Enter an email address we can reply to.';
    if (message.trim().length < 20)
      found.message =
        'A sentence or two helps us route your message to the right person.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSent(true);
    toast({
      title: 'Message ready to send',
      description: 'Email is not connected in this demonstration build.',
      tone: 'info',
    });
  }

  if (sent) {
    return (
      <div className="border-success-line bg-success-bg rounded-[var(--radius-card)] border p-6">
        <div className="flex gap-3">
          <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <h2 className="text-ink text-base font-semibold">Thanks, {name}</h2>
            <p className="text-ink-muted mt-2 text-sm leading-relaxed">
              Your message about “{topic.toLowerCase()}” passed validation and would now
              be sent to the support team. Email delivery is not connected in this
              demonstration, so nothing has actually left your browser.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSent(false);
                setMessage('');
              }}
            >
              Write another message
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={errors.name} required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              value={name}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field label="Email address" error={errors.email} required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              type="email"
              value={email}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label="What is it about?">
        {({ id }) => (
          <Select
            id={id}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            {TOPICS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Your message" error={errors.message} required>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            value={message}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={describedBy}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-36"
            placeholder="Tell us what you need. If it concerns a booking, include the reference."
          />
        )}
      </Field>

      <Button type="submit" size="lg">
        Send message
      </Button>
    </form>
  );
}
