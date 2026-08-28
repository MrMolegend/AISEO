'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { educationLevels, levelLabels } from '@/lib/data/subjects';
import type { Subject } from '@/lib/types';

/**
 * The hero search. It writes the same query parameters the marketplace reads,
 * so a shared link reproduces the search exactly.
 */
export function HeroSearch({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (subject) params.set('subject', subject);
    if (level) params.set('level', level);
    router.push(`/tutors${params.size ? `?${params}` : ''}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-line bg-surface rounded-[var(--radius-panel)] border p-3 shadow-[var(--shadow-card)]"
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="relative sm:col-span-2">
          <Search
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
            aria-hidden
          />
          <label htmlFor="hero-q" className="sr-only">
            Search by subject, topic or tutor name
          </label>
          <input
            id="hero-q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Subject, topic or tutor"
            className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle/80 hover:border-ink-subtle/60 focus:border-brand h-12 w-full rounded-[var(--radius-control)] border pr-3.5 pl-10 text-[0.9375rem]"
          />
        </div>

        <div>
          <label htmlFor="hero-subject" className="sr-only">
            Subject
          </label>
          <Select
            id="hero-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="h-12"
          >
            <option value="">Any subject</option>
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="hero-level" className="sr-only">
            Education level
          </label>
          <Select
            id="hero-level"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="h-12"
          >
            <option value="">Any level</option>
            {educationLevels.map((item) => (
              <option key={item} value={item}>
                {levelLabels[item]}
              </option>
            ))}
          </Select>
        </div>

        <Button type="submit" size="lg" className="h-12 sm:col-span-2">
          Search tutors
        </Button>
      </div>
    </form>
  );
}
