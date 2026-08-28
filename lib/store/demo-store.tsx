'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { STORAGE_KEYS } from './storage';
import { createLocalStore } from './local-store';
import {
  getAccount,
  getSeedApplications,
  getSeedBookings,
  getSeedConversations,
  getSeedReports,
  getTutor,
  getTutors,
} from '@/lib/queries';
import { defaultAccountByRole } from '@/lib/data/people';
import { FEE_RATE } from '@/lib/data/bookings';
import { at } from '@/lib/datetime';
import { shortId } from '@/lib/utils';
import type {
  Account,
  ApplicationStatus,
  ApplicationTimelineEntry,
  AvailabilitySlot,
  Booking,
  BookingStatus,
  Conversation,
  EducationLevel,
  ExperienceEntry,
  Message,
  PlatformReport,
  Qualification,
  ReportStatus,
  Role,
  Tutor,
  TutorApplication,
} from '@/lib/types';

/* ── State shape ──────────────────────────────────────────────────────────── */

export interface ApplicationDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  subjects: string[];
  levels: EducationLevel[];
  hourlyRate: number;
  yearsExperience: number;
  experience: string;
  qualifications: string;
  approach: string;
  availabilitySummary: string;
}

export type TutorProfilePatch = Partial<
  Pick<
    Tutor,
    | 'headline'
    | 'about'
    | 'teachingApproach'
    | 'subjects'
    | 'levels'
    | 'hourlyRate'
    | 'qualifications'
    | 'experience'
  >
>;

export interface AdminSettings {
  siteName: string;
  supportEmail: string;
  safeguardingContact: string;
  bookingWindowDays: number;
  minNoticeHours: number;
  platformFeePercent: number;
  featuredTutorIds: string[];
}

interface DemoState {
  accountId: string | null;
  favourites: string[];
  createdBookings: Booking[];
  bookingStatus: Record<string, BookingStatus>;
  sentMessages: Message[];
  createdConversations: Conversation[];
  readConversationIds: string[];
  submittedApplications: TutorApplication[];
  applicationStatus: Record<string, ApplicationStatus>;
  applicationTimeline: Record<string, ApplicationTimelineEntry[]>;
  applicationNotes: Record<string, { at: string; author: string; body: string }[]>;
  applicationDraft: ApplicationDraft | null;
  applicationDraftStep: number;
  availability: Record<string, AvailabilitySlot[]>;
  unavailableDates: Record<string, string[]>;
  tutorProfile: Record<string, TutorProfilePatch>;
  tutorFlags: Record<
    string,
    { verified?: boolean; featured?: boolean; suspended?: boolean }
  >;
  reportStatus: Record<string, ReportStatus>;
  adminSettings: AdminSettings;
  dismissedNotifications: string[];
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  siteName: 'Tutor Hub',
  supportEmail: 'support@tutorhub.example',
  safeguardingContact: 'safeguarding@tutorhub.example',
  bookingWindowDays: 30,
  minNoticeHours: 12,
  platformFeePercent: Math.round(FEE_RATE * 100),
  featuredTutorIds: getTutors()
    .filter((t) => t.featured)
    .map((t) => t.id),
};

const INITIAL_STATE: DemoState = {
  accountId: null,
  favourites: [],
  createdBookings: [],
  bookingStatus: {},
  sentMessages: [],
  createdConversations: [],
  readConversationIds: [],
  submittedApplications: [],
  applicationStatus: {},
  applicationTimeline: {},
  applicationNotes: {},
  applicationDraft: null,
  applicationDraftStep: 0,
  availability: {},
  unavailableDates: {},
  tutorProfile: {},
  tutorFlags: {},
  reportStatus: {},
  adminSettings: DEFAULT_ADMIN_SETTINGS,
  dismissedNotifications: [],
};

/**
 * The single source of truth for everything the visitor changes.
 *
 * It lives outside React so that reading localStorage after mount does not mean
 * setting state inside an effect — see `lib/store/local-store.ts`. The provider
 * below simply subscribes to it.
 */
const store = createLocalStore<DemoState>(
  STORAGE_KEYS.demo,
  INITIAL_STATE,
  (stored, base) => ({
    ...base,
    ...stored,
    // A settings object written by an earlier version may be missing keys.
    adminSettings: { ...DEFAULT_ADMIN_SETTINGS, ...(stored.adminSettings ?? {}) },
  }),
);

/* ── Booking input ────────────────────────────────────────────────────────── */

export interface NewBookingInput {
  tutorId: string;
  subjectId: string;
  level: EducationLevel;
  startsAt: string;
  durationMins: number;
  note?: string;
  learnerId?: string;
}

/* ── Context ──────────────────────────────────────────────────────────────── */

interface DemoContextValue {
  /** False until localStorage has been read; guards against hydration drift. */
  hydrated: boolean;
  account: Account | null;
  role: Role | null;

  tutors: Tutor[];
  bookings: Booking[];
  conversations: Conversation[];
  applications: TutorApplication[];
  reports: PlatformReport[];
  favourites: string[];
  adminSettings: AdminSettings;
  applicationDraft: ApplicationDraft | null;
  applicationDraftStep: number;

  signIn: (accountId: string) => Account | null;
  signInAsRole: (role: Role) => Account | null;
  signOut: () => void;

  isFavourite: (tutorId: string) => boolean;
  toggleFavourite: (tutorId: string) => boolean;

  createBooking: (input: NewBookingInput) => Booking;
  setBookingStatus: (bookingId: string, status: BookingStatus) => void;
  getBooking: (bookingId: string) => Booking | undefined;

  getConversation: (id: string) => Conversation | undefined;
  sendMessage: (conversationId: string, body: string) => void;
  startConversation: (tutorId: string) => string;
  markConversationRead: (id: string) => void;
  isConversationUnread: (conversation: Conversation) => boolean;

  saveApplicationDraft: (draft: ApplicationDraft, step: number) => void;
  submitApplication: (draft: ApplicationDraft) => TutorApplication;
  clearApplicationDraft: () => void;
  decideApplication: (id: string, status: ApplicationStatus, label: string) => void;
  addApplicationNote: (id: string, body: string) => void;

  getAvailability: (tutorId: string) => AvailabilitySlot[];
  setAvailability: (tutorId: string, slots: AvailabilitySlot[]) => void;
  getUnavailableDates: (tutorId: string) => string[];
  toggleUnavailableDate: (tutorId: string, date: string) => void;

  saveTutorProfile: (tutorId: string, patch: TutorProfilePatch) => void;
  setTutorFlags: (
    tutorId: string,
    patch: { verified?: boolean; featured?: boolean; suspended?: boolean },
  ) => void;
  isSuspended: (tutorId: string) => boolean;

  setReportStatus: (id: string, status: ReportStatus) => void;
  updateAdminSettings: (patch: Partial<AdminSettings>) => void;

  dismissNotification: (id: string) => void;
  dismissedNotifications: string[];

  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

/* ── Provider ─────────────────────────────────────────────────────────────── */

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const hydrated = useSyncExternalStore(store.subscribe, store.isHydrated, () => false);

  const patch = useCallback((update: Partial<DemoState>) => {
    store.update((current) => ({ ...current, ...update }));
  }, []);

  /* ── Session ────────────────────────────────────────────────────────── */

  const account = useMemo(
    () => getAccount(state.accountId ?? undefined) ?? null,
    [state.accountId],
  );

  const signIn = useCallback(
    (accountId: string) => {
      const next = getAccount(accountId) ?? null;
      if (next) patch({ accountId });
      return next;
    },
    [patch],
  );

  const signInAsRole = useCallback(
    (role: Role) => signIn(defaultAccountByRole[role]),
    [signIn],
  );

  const signOut = useCallback(() => patch({ accountId: null }), [patch]);

  /* ── Tutors (admin flags and profile edits applied) ──────────────────── */

  const tutors = useMemo(() => {
    return getTutors().map((tutor) => {
      const flags = state.tutorFlags[tutor.id];
      const profile = state.tutorProfile[tutor.id];
      const availability = state.availability[tutor.id];
      if (!flags && !profile && !availability) return tutor;
      return {
        ...tutor,
        ...profile,
        ...(availability ? { availability } : {}),
        verified: flags?.verified ?? tutor.verified,
        featured: flags?.featured ?? tutor.featured,
      };
    });
  }, [state.tutorFlags, state.tutorProfile, state.availability]);

  const isSuspended = useCallback(
    (tutorId: string) => state.tutorFlags[tutorId]?.suspended === true,
    [state.tutorFlags],
  );

  /* ── Bookings ───────────────────────────────────────────────────────── */

  const bookings = useMemo(() => {
    const all = [...getSeedBookings(), ...state.createdBookings];
    return all
      .map((booking) => {
        const override = state.bookingStatus[booking.id];
        return override ? { ...booking, status: override } : booking;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [state.createdBookings, state.bookingStatus]);

  const createBooking = useCallback(
    (input: NewBookingInput): Booking => {
      const tutor = getTutor(input.tutorId);
      const hourly = tutor?.hourlyRate ?? 3500;
      const lessonPence = Math.round((hourly * input.durationMins) / 60);
      const feePence = Math.round((lessonPence * FEE_RATE) / 10) * 10;
      const booking: Booking = {
        id: shortId('b'),
        reference: `TH-${Math.floor(5000 + Math.random() * 4000)}`,
        tutorId: input.tutorId,
        bookedById: state.accountId ?? defaultAccountByRole.student,
        subjectId: input.subjectId,
        level: input.level,
        startsAt: input.startsAt,
        durationMins: input.durationMins,
        lessonPence,
        feePence,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        ...(input.note ? { note: input.note } : {}),
        ...(input.learnerId ? { learnerId: input.learnerId } : {}),
      };
      store.update((current) => ({
        ...current,
        createdBookings: [...current.createdBookings, booking],
      }));
      return booking;
    },
    [state.accountId],
  );

  const setBookingStatus = useCallback((bookingId: string, status: BookingStatus) => {
    store.update((current) => ({
      ...current,
      bookingStatus: { ...current.bookingStatus, [bookingId]: status },
    }));
  }, []);

  const getBooking = useCallback(
    (bookingId: string) => bookings.find((b) => b.id === bookingId),
    [bookings],
  );

  /* ── Conversations ──────────────────────────────────────────────────── */

  const conversations = useMemo(() => {
    const base = [...getSeedConversations(), ...state.createdConversations];
    return base
      .map((conversation) => {
        const extra = state.sentMessages.filter(
          (m) => m.conversationId === conversation.id,
        );
        if (extra.length === 0) return conversation;
        return { ...conversation, messages: [...conversation.messages, ...extra] };
      })
      .sort((a, b) => lastMessageTime(b) - lastMessageTime(a));
  }, [state.createdConversations, state.sentMessages]);

  const getConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id),
    [conversations],
  );

  const sendMessage = useCallback(
    (conversationId: string, body: string) => {
      const senderId = resolveSenderId(state.accountId);
      const message: Message = {
        id: shortId('m'),
        conversationId,
        senderId,
        body,
        sentAt: new Date().toISOString(),
      };
      store.update((current) => ({
        ...current,
        sentMessages: [...current.sentMessages, message],
        readConversationIds: current.readConversationIds.includes(conversationId)
          ? current.readConversationIds
          : [...current.readConversationIds, conversationId],
      }));
    },
    [state.accountId],
  );

  const startConversation = useCallback(
    (tutorId: string) => {
      const memberId = state.accountId ?? defaultAccountByRole.student;
      const existing = conversations.find(
        (c) => c.tutorId === tutorId && c.memberId === memberId,
      );
      if (existing) return existing.id;

      const conversation: Conversation = {
        id: shortId('c'),
        tutorId,
        memberId,
        messages: [],
        tutorLastSeenMins: 30,
      };
      store.update((current) => ({
        ...current,
        createdConversations: [...current.createdConversations, conversation],
      }));
      return conversation.id;
    },
    [conversations, state.accountId],
  );

  const markConversationRead = useCallback((id: string) => {
    store.update((current) =>
      current.readConversationIds.includes(id)
        ? current
        : { ...current, readConversationIds: [...current.readConversationIds, id] },
    );
  }, []);

  const isConversationUnread = useCallback(
    (conversation: Conversation) => {
      if (state.readConversationIds.includes(conversation.id)) return false;
      const last = conversation.messages[conversation.messages.length - 1];
      if (!last) return false;
      return last.senderId !== resolveSenderId(state.accountId);
    },
    [state.readConversationIds, state.accountId],
  );

  /* ── Applications ───────────────────────────────────────────────────── */

  const applications = useMemo(() => {
    const all = [...state.submittedApplications, ...getSeedApplications()];
    return all
      .map((application) => {
        const status = state.applicationStatus[application.id];
        const extraTimeline = state.applicationTimeline[application.id] ?? [];
        const extraNotes = state.applicationNotes[application.id] ?? [];
        if (!status && extraTimeline.length === 0 && extraNotes.length === 0) {
          return application;
        }
        return {
          ...application,
          status: status ?? application.status,
          timeline: [...application.timeline, ...extraTimeline],
          internalNotes: [...application.internalNotes, ...extraNotes],
        };
      })
      .sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      );
  }, [
    state.submittedApplications,
    state.applicationStatus,
    state.applicationTimeline,
    state.applicationNotes,
  ]);

  const saveApplicationDraft = useCallback((draft: ApplicationDraft, step: number) => {
    store.update((current) => ({
      ...current,
      applicationDraft: draft,
      applicationDraftStep: step,
    }));
  }, []);

  const submitApplication = useCallback((draft: ApplicationDraft): TutorApplication => {
    const now = new Date().toISOString();
    const application: TutorApplication = {
      id: shortId('app'),
      ...draft,
      status: 'under-review',
      submittedAt: now,
      timeline: [
        {
          at: now,
          label: 'Application submitted',
          by: `${draft.firstName} ${draft.lastName}`,
        },
        { at: now, label: 'Automatic checks passed', by: 'Tutor Hub' },
      ],
      internalNotes: [],
      avatarTone: 2,
    };
    store.update((current) => ({
      ...current,
      submittedApplications: [application, ...current.submittedApplications],
      applicationDraft: null,
      applicationDraftStep: 0,
    }));
    return application;
  }, []);

  const clearApplicationDraft = useCallback(() => {
    patch({ applicationDraft: null, applicationDraftStep: 0 });
  }, [patch]);

  const decideApplication = useCallback(
    (id: string, status: ApplicationStatus, label: string) => {
      const entry: ApplicationTimelineEntry = {
        at: new Date().toISOString(),
        label,
        by: 'Dan Foster',
      };
      store.update((current) => ({
        ...current,
        applicationStatus: { ...current.applicationStatus, [id]: status },
        applicationTimeline: {
          ...current.applicationTimeline,
          [id]: [...(current.applicationTimeline[id] ?? []), entry],
        },
      }));
    },
    [],
  );

  const addApplicationNote = useCallback((id: string, body: string) => {
    const note = { at: new Date().toISOString(), author: 'Dan Foster', body };
    store.update((current) => ({
      ...current,
      applicationNotes: {
        ...current.applicationNotes,
        [id]: [...(current.applicationNotes[id] ?? []), note],
      },
    }));
  }, []);

  /* ── Availability ───────────────────────────────────────────────────── */

  const getAvailability = useCallback(
    (tutorId: string) =>
      state.availability[tutorId] ?? getTutor(tutorId)?.availability ?? [],
    [state.availability],
  );

  const setAvailability = useCallback((tutorId: string, slots: AvailabilitySlot[]) => {
    store.update((current) => ({
      ...current,
      availability: { ...current.availability, [tutorId]: slots },
    }));
  }, []);

  const getUnavailableDates = useCallback(
    (tutorId: string) => state.unavailableDates[tutorId] ?? [],
    [state.unavailableDates],
  );

  const toggleUnavailableDate = useCallback((tutorId: string, date: string) => {
    store.update((current) => {
      const list = current.unavailableDates[tutorId] ?? [];
      const next = list.includes(date)
        ? list.filter((d) => d !== date)
        : [...list, date].sort();
      return {
        ...current,
        unavailableDates: { ...current.unavailableDates, [tutorId]: next },
      };
    });
  }, []);

  /* ── Tutor profile and admin flags ──────────────────────────────────── */

  const saveTutorProfile = useCallback(
    (tutorId: string, profilePatch: TutorProfilePatch) => {
      store.update((current) => ({
        ...current,
        tutorProfile: {
          ...current.tutorProfile,
          [tutorId]: { ...current.tutorProfile[tutorId], ...profilePatch },
        },
      }));
    },
    [],
  );

  const setTutorFlags = useCallback(
    (
      tutorId: string,
      flagPatch: { verified?: boolean; featured?: boolean; suspended?: boolean },
    ) => {
      store.update((current) => ({
        ...current,
        tutorFlags: {
          ...current.tutorFlags,
          [tutorId]: { ...current.tutorFlags[tutorId], ...flagPatch },
        },
      }));
    },
    [],
  );

  /* ── Reports and settings ───────────────────────────────────────────── */

  const reports = useMemo(
    () =>
      getSeedReports().map((report) => {
        const status = state.reportStatus[report.id];
        return status ? { ...report, status } : report;
      }),
    [state.reportStatus],
  );

  const setReportStatus = useCallback((id: string, status: ReportStatus) => {
    store.update((current) => ({
      ...current,
      reportStatus: { ...current.reportStatus, [id]: status },
    }));
  }, []);

  const updateAdminSettings = useCallback((settingsPatch: Partial<AdminSettings>) => {
    store.update((current) => ({
      ...current,
      adminSettings: { ...current.adminSettings, ...settingsPatch },
    }));
  }, []);

  /* ── Favourites and notifications ───────────────────────────────────── */

  const isFavourite = useCallback(
    (tutorId: string) => state.favourites.includes(tutorId),
    [state.favourites],
  );

  const toggleFavourite = useCallback((tutorId: string) => {
    let added = false;
    store.update((current) => {
      added = !current.favourites.includes(tutorId);
      return {
        ...current,
        favourites: added
          ? [...current.favourites, tutorId]
          : current.favourites.filter((id) => id !== tutorId),
      };
    });
    return added;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    store.update((current) =>
      current.dismissedNotifications.includes(id)
        ? current
        : { ...current, dismissedNotifications: [...current.dismissedNotifications, id] },
    );
  }, []);

  const resetDemo = useCallback(() => {
    store.reset({ ...INITIAL_STATE, accountId: null });
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({
      hydrated,
      account,
      role: account?.role ?? null,
      tutors,
      bookings,
      conversations,
      applications,
      reports,
      favourites: state.favourites,
      adminSettings: state.adminSettings,
      applicationDraft: state.applicationDraft,
      applicationDraftStep: state.applicationDraftStep,
      signIn,
      signInAsRole,
      signOut,
      isFavourite,
      toggleFavourite,
      createBooking,
      setBookingStatus,
      getBooking,
      getConversation,
      sendMessage,
      startConversation,
      markConversationRead,
      isConversationUnread,
      saveApplicationDraft,
      submitApplication,
      clearApplicationDraft,
      decideApplication,
      addApplicationNote,
      getAvailability,
      setAvailability,
      getUnavailableDates,
      toggleUnavailableDate,
      saveTutorProfile,
      setTutorFlags,
      isSuspended,
      setReportStatus,
      updateAdminSettings,
      dismissNotification,
      dismissedNotifications: state.dismissedNotifications,
      resetDemo,
    }),
    [
      hydrated,
      account,
      tutors,
      bookings,
      conversations,
      applications,
      reports,
      state.favourites,
      state.adminSettings,
      state.applicationDraft,
      state.applicationDraftStep,
      state.dismissedNotifications,
      signIn,
      signInAsRole,
      signOut,
      isFavourite,
      toggleFavourite,
      createBooking,
      setBookingStatus,
      getBooking,
      getConversation,
      sendMessage,
      startConversation,
      markConversationRead,
      isConversationUnread,
      saveApplicationDraft,
      submitApplication,
      clearApplicationDraft,
      decideApplication,
      addApplicationNote,
      getAvailability,
      setAvailability,
      getUnavailableDates,
      toggleUnavailableDate,
      saveTutorProfile,
      setTutorFlags,
      isSuspended,
      setReportStatus,
      updateAdminSettings,
      dismissNotification,
      resetDemo,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>');
  return ctx;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function lastMessageTime(conversation: Conversation): number {
  const last = conversation.messages[conversation.messages.length - 1];
  return last ? new Date(last.sentAt).getTime() : 0;
}

/**
 * A tutor's messages are stamped with their tutor id rather than their account
 * id, because that is what the seed threads use and what the marketplace knows
 * them by.
 */
function resolveSenderId(accountId: string | null): string {
  const account = getAccount(accountId ?? undefined);
  if (account?.role === 'tutor' && account.tutorId) return account.tutorId;
  return account?.id ?? defaultAccountByRole.student;
}

/** Exported for the seeded application form and the qualification editor. */
export type { Qualification, ExperienceEntry };

export const EMPTY_APPLICATION_DRAFT: ApplicationDraft = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: '',
  headline: '',
  subjects: [],
  levels: [],
  hourlyRate: 3500,
  yearsExperience: 0,
  experience: '',
  qualifications: '',
  approach: '',
  availabilitySummary: '',
};

/** Only used by the seeded "next available" hint on the booking screen. */
export const demoNextAvailable = (days: number, hour: number) => at(days, hour);
