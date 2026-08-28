'use client';

import { useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { WEEKDAYS, generateSlots } from '@/lib/availability';
import { DAY, formatDayMonth, todayUtc } from '@/lib/datetime';
import { shortId, pluralise } from '@/lib/utils';
import type { AvailabilitySlot } from '@/lib/types';

const HOURS = Array.from({ length: 16 }, (_, index) => {
  const hour = index + 7;
  return `${hour < 10 ? '0' : ''}${hour}:00`;
});

/**
 * Weekly hours plus one-off blocked dates. Changes save to the demo store the
 * moment they are made, and the preview underneath recomputes from the same
 * `generateSlots` the booking flow uses — so what a tutor sees here is exactly
 * what a student will be offered.
 */
export default function TutorAvailabilityPage() {
  const {
    account,
    hydrated,
    getAvailability,
    setAvailability,
    getUnavailableDates,
    toggleUnavailableDate,
  } = useDemo();
  const { toast } = useToast();
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [newStart, setNewStart] = useState('16:00');
  const [newEnd, setNewEnd] = useState('19:00');

  if (!hydrated || !account?.tutorId) return <Skeleton className="h-96 w-full" />;

  const tutorId = account.tutorId;
  const slots = getAvailability(tutorId);
  const blocked = getUnavailableDates(tutorId);

  function addSlot(day: number) {
    if (newStart >= newEnd) {
      toast({
        title: 'Check the times',
        description: 'The end time has to be after the start time.',
        tone: 'warning',
      });
      return;
    }
    const slot: AvailabilitySlot = {
      id: shortId('slot'),
      day,
      start: newStart,
      end: newEnd,
    };
    setAvailability(tutorId, [...slots, slot]);
    setAddingDay(null);
    toast({
      title: 'Hours added',
      description: `${WEEKDAYS.find((d) => d.value === day)?.label}, ${newStart}–${newEnd}.`,
    });
  }

  function removeSlot(id: string) {
    setAvailability(
      tutorId,
      slots.filter((slot) => slot.id !== id),
    );
    toast({ title: 'Hours removed', tone: 'info' });
  }

  function updateSlot(id: string, patch: Partial<AvailabilitySlot>) {
    setAvailability(
      tutorId,
      slots.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
    );
  }

  const preview = generateSlots({
    availability: slots,
    days: 14,
    unavailableDates: blocked,
  });
  const bookableCount = preview.reduce((total, day) => total + day.times.length, 0);

  const nextFortnight = Array.from({ length: 14 }, (_, index) => {
    const ms = todayUtc() + index * DAY;
    return {
      key: new Date(ms).toISOString().slice(0, 10),
      iso: new Date(ms).toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        lead="Set the hours you teach each week, then block out the individual dates you cannot make. Students only ever see slots that survive both."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-ink-subtle text-sm">Weekly blocks</p>
          <p className="tabular mt-2 text-2xl font-semibold">{slots.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-ink-subtle text-sm">Bookable slots, next 14 days</p>
          <p className="tabular mt-2 text-2xl font-semibold">{bookableCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-ink-subtle text-sm">Dates blocked</p>
          <p className="tabular mt-2 text-2xl font-semibold">{blocked.length}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Weekly hours</CardTitle>
          <p className="text-ink-subtle text-sm">Times are UTC</p>
        </CardHeader>
        <CardBody>
          <ul className="divide-line divide-y">
            {WEEKDAYS.map((day) => {
              const daySlots = slots.filter((slot) => slot.day === day.value);
              return (
                <li key={day.value} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{day.label}</h3>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {daySlots.length === 0
                          ? 'Not available'
                          : `${daySlots.length} ${pluralise(daySlots.length, 'block')}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setAddingDay(addingDay === day.value ? null : day.value)
                      }
                      aria-expanded={addingDay === day.value}
                    >
                      <Plus className="size-4" aria-hidden />
                      Add hours
                    </Button>
                  </div>

                  {daySlots.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {daySlots.map((slot) => (
                        <li
                          key={slot.id}
                          className="border-line bg-surface-subtle flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border p-2"
                        >
                          <label className="sr-only" htmlFor={`${slot.id}-start`}>
                            {day.label} start time
                          </label>
                          <Select
                            id={`${slot.id}-start`}
                            value={slot.start}
                            onChange={(event) =>
                              updateSlot(slot.id, { start: event.target.value })
                            }
                            className="h-10 w-auto text-sm"
                          >
                            {HOURS.map((hour) => (
                              <option key={hour} value={hour}>
                                {hour}
                              </option>
                            ))}
                          </Select>
                          <span className="text-ink-subtle text-sm">to</span>
                          <label className="sr-only" htmlFor={`${slot.id}-end`}>
                            {day.label} end time
                          </label>
                          <Select
                            id={`${slot.id}-end`}
                            value={slot.end}
                            onChange={(event) =>
                              updateSlot(slot.id, { end: event.target.value })
                            }
                            className="h-10 w-auto text-sm"
                          >
                            {HOURS.map((hour) => (
                              <option key={hour} value={hour}>
                                {hour}
                              </option>
                            ))}
                          </Select>
                          <button
                            type="button"
                            onClick={() => removeSlot(slot.id)}
                            className="text-ink-subtle hover:text-danger ml-auto flex size-10 items-center justify-center rounded-[var(--radius-control)]"
                          >
                            <Trash2 className="size-4" aria-hidden />
                            <span className="sr-only">
                              Remove {day.label} {slot.start} to {slot.end}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {addingDay === day.value && (
                    <div className="border-brand-line bg-brand-subtle/50 mt-3 flex flex-wrap items-end gap-2 rounded-[var(--radius-control)] border p-3">
                      <div>
                        <label
                          htmlFor={`new-start-${day.value}`}
                          className="text-ink-subtle mb-1 block text-xs font-medium"
                        >
                          From
                        </label>
                        <Select
                          id={`new-start-${day.value}`}
                          value={newStart}
                          onChange={(event) => setNewStart(event.target.value)}
                          className="h-10 w-auto text-sm"
                        >
                          {HOURS.map((hour) => (
                            <option key={hour} value={hour}>
                              {hour}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label
                          htmlFor={`new-end-${day.value}`}
                          className="text-ink-subtle mb-1 block text-xs font-medium"
                        >
                          To
                        </label>
                        <Select
                          id={`new-end-${day.value}`}
                          value={newEnd}
                          onChange={(event) => setNewEnd(event.target.value)}
                          className="h-10 w-auto text-sm"
                        >
                          {HOURS.map((hour) => (
                            <option key={hour} value={hour}>
                              {hour}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button size="sm" onClick={() => addSlot(day.value)}>
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAddingDay(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Dates you are unavailable</CardTitle>
          <p className="text-ink-subtle text-sm">Next 14 days</p>
        </CardHeader>
        <CardBody>
          <p className="text-ink-muted mb-4 text-sm leading-relaxed">
            Select a date to close it entirely — useful for holidays, exam invigilation or
            anything else that overrides the weekly pattern.
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {nextFortnight.map((date) => {
              const isBlocked = blocked.includes(date.key);
              return (
                <li key={date.key}>
                  <button
                    type="button"
                    aria-pressed={isBlocked}
                    onClick={() => {
                      toggleUnavailableDate(tutorId, date.key);
                      toast({
                        title: isBlocked ? 'Date reopened' : 'Date blocked',
                        description: formatDayMonth(date.iso),
                        tone: isBlocked ? 'info' : 'success',
                      });
                    }}
                    className={`flex min-h-14 w-full flex-col items-center justify-center rounded-[var(--radius-control)] border text-xs transition-colors duration-[var(--duration-fast)] ${
                      isBlocked
                        ? 'border-danger-line bg-danger-bg text-danger'
                        : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle'
                    }`}
                  >
                    <span className="tabular text-sm font-semibold">
                      {new Date(date.iso).getUTCDate()}
                    </span>
                    <span>{formatDayMonth(date.iso).split(' ')[1]}</span>
                    {isBlocked && <span className="sr-only">Blocked</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {blocked.length > 0 && (
            <div className="border-line mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              <CalendarOff className="text-ink-subtle size-4" aria-hidden />
              <span className="text-ink-subtle text-sm">Blocked:</span>
              {blocked.map((key) => (
                <Badge key={key} tone="danger">
                  {formatDayMonth(`${key}T00:00:00.000Z`)}
                </Badge>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
