import {
  Atom,
  Beaker,
  BookOpen,
  Brain,
  Briefcase,
  Globe2,
  Leaf,
  LineChart,
  Sigma,
  Terminal,
} from 'lucide-react';

/**
 * Subjects carry an icon key rather than a component so `lib/data/subjects.ts`
 * stays a plain data module. Anything unrecognised falls back to a book.
 */
const ICONS = {
  maths: Sigma,
  biology: Leaf,
  chemistry: Beaker,
  physics: Atom,
  english: BookOpen,
  economics: LineChart,
  computing: Terminal,
  psychology: Brain,
  business: Briefcase,
  geography: Globe2,
  statistics: LineChart,
} as const;

export function SubjectIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? BookOpen;
  return <Icon className={className} aria-hidden />;
}
