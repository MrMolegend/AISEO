import {
  CalendarDays,
  Clock4,
  Flag,
  GraduationCap,
  Heart,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Settings,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react';

const ICONS = {
  home: LayoutDashboard,
  calendar: CalendarDays,
  messages: MessageSquare,
  heart: Heart,
  progress: TrendingUp,
  settings: Settings,
  clock: Clock4,
  users: Users,
  wallet: Wallet,
  user: User,
  inbox: Inbox,
  graduation: GraduationCap,
  flag: Flag,
} as const;

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden />;
}
