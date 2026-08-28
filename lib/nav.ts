import type { Role } from '@/lib/types';

/** Where each role's dashboard lives. */
export const DASHBOARD_HOME: Record<Role, string> = {
  student: '/student',
  parent: '/parent',
  tutor: '/tutor',
  admin: '/admin',
};

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  parent: 'Parent',
  tutor: 'Tutor',
  admin: 'Administrator',
};

export interface NavLink {
  href: string;
  label: string;
  /** Lucide icon name, resolved in `components/dashboard/nav-icon.tsx`. */
  icon: string;
  /** Shown in the mobile bottom bar. Everything else lives in "More". */
  primary?: boolean;
}

export const PUBLIC_NAV: { href: string; label: string }[] = [
  { href: '/tutors', label: 'Find a tutor' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/become-a-tutor', label: 'Become a tutor' },
  { href: '/about', label: 'About' },
];

export const DASHBOARD_NAV: Record<Role, NavLink[]> = {
  student: [
    { href: '/student', label: 'Overview', icon: 'home', primary: true },
    { href: '/student/lessons', label: 'Lessons', icon: 'calendar', primary: true },
    { href: '/messages', label: 'Messages', icon: 'messages', primary: true },
    { href: '/student/saved', label: 'Saved tutors', icon: 'heart', primary: true },
    { href: '/student/progress', label: 'Progress', icon: 'progress' },
    { href: '/student/settings', label: 'Settings', icon: 'settings' },
  ],
  tutor: [
    { href: '/tutor', label: 'Overview', icon: 'home', primary: true },
    { href: '/tutor/lessons', label: 'Lessons', icon: 'calendar', primary: true },
    { href: '/tutor/availability', label: 'Availability', icon: 'clock', primary: true },
    { href: '/tutor/messages', label: 'Messages', icon: 'messages', primary: true },
    { href: '/tutor/students', label: 'Students', icon: 'users' },
    { href: '/tutor/earnings', label: 'Earnings', icon: 'wallet' },
    { href: '/tutor/profile', label: 'Public profile', icon: 'user' },
    { href: '/tutor/settings', label: 'Settings', icon: 'settings' },
  ],
  parent: [
    { href: '/parent', label: 'Overview', icon: 'home', primary: true },
    { href: '/parent/learners', label: 'Learners', icon: 'users', primary: true },
    { href: '/parent/lessons', label: 'Lessons', icon: 'calendar', primary: true },
    { href: '/parent/messages', label: 'Messages', icon: 'messages', primary: true },
    { href: '/parent/progress', label: 'Progress', icon: 'progress' },
    { href: '/parent/settings', label: 'Settings', icon: 'settings' },
  ],
  admin: [
    { href: '/admin', label: 'Overview', icon: 'home', primary: true },
    { href: '/admin/applications', label: 'Applications', icon: 'inbox', primary: true },
    { href: '/admin/tutors', label: 'Tutors', icon: 'graduation', primary: true },
    { href: '/admin/bookings', label: 'Bookings', icon: 'calendar', primary: true },
    { href: '/admin/users', label: 'Users', icon: 'users' },
    { href: '/admin/reports', label: 'Reports', icon: 'flag' },
    { href: '/admin/settings', label: 'Settings', icon: 'settings' },
  ],
};

export const FOOTER_LINKS: {
  heading: string;
  links: { href: string; label: string }[];
}[] = [
  {
    heading: 'Learn',
    links: [
      { href: '/tutors', label: 'Find a tutor' },
      { href: '/how-it-works', label: 'How it works' },
      { href: '/tutors?level=GCSE', label: 'GCSE tuition' },
      { href: '/tutors?level=A-Level', label: 'A-Level tuition' },
      { href: '/tutors?level=University', label: 'University support' },
    ],
  },
  {
    heading: 'Teach',
    links: [
      { href: '/become-a-tutor', label: 'Become a tutor' },
      { href: '/become-a-tutor#application', label: 'Start an application' },
      { href: '/how-it-works#tutors', label: 'How tutoring works' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About Tutor Hub' },
      { href: '/about#safety', label: 'Trust and safety' },
      { href: '/contact', label: 'Contact us' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms of use' },
      { href: '/safeguarding', label: 'Safeguarding' },
    ],
  },
];
