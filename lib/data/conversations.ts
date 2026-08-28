import type { Conversation } from '@/lib/types';
import { at } from '@/lib/datetime';

/**
 * Short, plausible threads. Messages sent in the demo are appended here through
 * the store and persisted locally; Supabase Realtime replaces the transport,
 * not the component.
 */
export const conversations: Conversation[] = [
  {
    id: 'c-maya-amara',
    tutorId: 't-amara',
    memberId: 'u-maya',
    bookingId: 'b-1001',
    tutorLastSeenMins: 4,
    messages: [
      {
        id: 'm1',
        conversationId: 'c-maya-amara',
        senderId: 'u-maya',
        body: 'Hi Amara — I got stuck on question 6 of the June 2023 paper. Could we look at it on Thursday?',
        sentAt: at(-2, 18, 12),
      },
      {
        id: 'm2',
        conversationId: 'c-maya-amara',
        senderId: 't-amara',
        body: 'Of course. Send me a photo of what you tried and I will look before the lesson.',
        sentAt: at(-2, 18, 40),
      },
      {
        id: 'm3',
        conversationId: 'c-maya-amara',
        senderId: 'u-maya',
        body: 'Sent it to my notes — I got as far as the substitution and then it went wrong.',
        sentAt: at(-1, 9, 5),
      },
      {
        id: 'm4',
        conversationId: 'c-maya-amara',
        senderId: 't-amara',
        body: 'That substitution is fine, the limits need changing too. We will do it properly on Thursday.',
        sentAt: at(-1, 9, 22),
      },
    ],
  },
  {
    id: 'c-maya-tom',
    tutorId: 't-tom',
    memberId: 'u-maya',
    bookingId: 'b-1002',
    tutorLastSeenMins: 130,
    messages: [
      {
        id: 'm5',
        conversationId: 'c-maya-tom',
        senderId: 't-tom',
        body: 'Nice work on the momentum questions. Have a go at 4 and 5 in the pack before Friday.',
        sentAt: at(-3, 20, 15),
      },
      {
        id: 'm6',
        conversationId: 'c-maya-tom',
        senderId: 'u-maya',
        body: 'Will do. Is 90 minutes still OK for Friday?',
        sentAt: at(-3, 20, 31),
      },
      {
        id: 'm7',
        conversationId: 'c-maya-tom',
        senderId: 't-tom',
        body: 'Yes — we need it for circular motion.',
        sentAt: at(-3, 21, 2),
      },
    ],
  },
  {
    id: 'c-maya-nadia',
    tutorId: 't-nadia',
    memberId: 'u-maya',
    tutorLastSeenMins: 1500,
    messages: [
      {
        id: 'm8',
        conversationId: 'c-maya-nadia',
        senderId: 'u-maya',
        body: 'Hi — I had to cancel last month but I would like to restart Psychology before the mocks. Do you have a Sunday slot?',
        sentAt: at(-5, 11, 0),
      },
      {
        id: 'm9',
        conversationId: 'c-maya-nadia',
        senderId: 't-nadia',
        body: 'I do, 13:00 or 15:00 on Sundays. Send a booking request for whichever suits.',
        sentAt: at(-5, 12, 44),
      },
    ],
  },
  {
    id: 'c-sarah-priya',
    tutorId: 't-priya',
    memberId: 'u-sarah',
    learnerId: 'l-anya',
    bookingId: 'b-1006',
    tutorLastSeenMins: 8,
    messages: [
      {
        id: 'm10',
        conversationId: 'c-sarah-priya',
        senderId: 'u-sarah',
        body: 'Anya has her Chemistry mock on the 14th. Could tomorrow focus on moles and titration?',
        sentAt: at(-1, 19, 30),
      },
      {
        id: 'm11',
        conversationId: 'c-sarah-priya',
        senderId: 't-priya',
        body: 'Yes, that is a good use of the hour. I will bring a titration calculation set as well.',
        sentAt: at(-1, 20, 3),
      },
      {
        id: 'm12',
        conversationId: 'c-sarah-priya',
        senderId: 'u-sarah',
        body: 'Thank you.',
        sentAt: at(-1, 20, 10),
      },
    ],
  },
  {
    id: 'c-sarah-callum',
    tutorId: 't-callum',
    memberId: 'u-sarah',
    learnerId: 'l-rohan',
    bookingId: 'b-1007',
    tutorLastSeenMins: 600,
    messages: [
      {
        id: 'm13',
        conversationId: 'c-sarah-callum',
        senderId: 't-callum',
        body: 'Rohan sent me both essays — the second one is a real improvement on evaluation. We will build on it Wednesday.',
        sentAt: at(-2, 16, 20),
      },
      {
        id: 'm14',
        conversationId: 'c-sarah-callum',
        senderId: 'u-sarah',
        body: 'That is good to hear. Is he on track for the A he needs?',
        sentAt: at(-2, 17, 5),
      },
      {
        id: 'm15',
        conversationId: 'c-sarah-callum',
        senderId: 't-callum',
        body: 'On the current trajectory, yes, provided he keeps writing one timed essay a week.',
        sentAt: at(-2, 17, 41),
      },
    ],
  },
  {
    id: 'c-jack-priya',
    tutorId: 't-priya',
    memberId: 'u-jack',
    bookingId: 'b-1010',
    tutorLastSeenMins: 8,
    messages: [
      {
        id: 'm16',
        conversationId: 'c-jack-priya',
        senderId: 'u-jack',
        body: 'Hello — I have requested a Biology lesson for next week. Is Thursday any good going forward?',
        sentAt: at(0, 8, 15),
      },
    ],
  },
  {
    id: 'c-ife-joseph',
    tutorId: 't-joseph',
    memberId: 'u-ife',
    tutorLastSeenMins: 45,
    messages: [
      {
        id: 'm17',
        conversationId: 'c-ife-joseph',
        senderId: 'u-ife',
        body: 'The open-addressing implementation works but it degrades badly at 80% load. Is that expected?',
        sentAt: at(-4, 21, 12),
      },
      {
        id: 'm18',
        conversationId: 'c-ife-joseph',
        senderId: 't-joseph',
        body: 'Entirely expected with linear probing. Read up on clustering before Tuesday and we will fix it with a better probe sequence.',
        sentAt: at(-4, 21, 30),
      },
    ],
  },
];
