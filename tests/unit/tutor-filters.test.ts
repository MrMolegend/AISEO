import { describe, expect, it } from 'vitest';
import {
  countActiveFilters,
  defaultFilters,
  filterTutors,
  getTutors,
  priceBounds,
  sortTutors,
} from '@/lib/queries';
import { DAY } from '@/lib/datetime';
import type { TutorFilters } from '@/lib/types';

const all = getTutors();
const base: TutorFilters = { ...defaultFilters };

describe('filterTutors', () => {
  it('returns every tutor when nothing is filtered', () => {
    expect(filterTutors(all, base)).toHaveLength(all.length);
  });

  it('matches free text against names, headlines and subjects', () => {
    expect(filterTutors(all, { ...base, query: 'okonkwo' }).map((t) => t.slug)).toEqual([
      'amara-okonkwo',
    ]);

    // The corpus is wider than the subject list — a qualification mentioning
    // Chemistry counts as a match too, which is what a searcher expects.
    const chemistry = filterTutors(all, { ...base, query: 'chemistry' });
    expect(chemistry.length).toBeGreaterThan(1);
    expect(chemistry.map((tutor) => tutor.slug)).toEqual(
      expect.arrayContaining(['priya-raghavan', 'sofia-marchetti']),
    );
  });

  it('is case-insensitive and ignores surrounding space', () => {
    expect(filterTutors(all, { ...base, query: '  PHYSICS ' }).length).toBe(
      filterTutors(all, { ...base, query: 'physics' }).length,
    );
  });

  it('filters by subject and by level', () => {
    const maths = filterTutors(all, { ...base, subject: 'maths' });
    expect(maths.every((tutor) => tutor.subjects.includes('maths'))).toBe(true);

    const gcse = filterTutors(all, { ...base, level: 'GCSE' });
    expect(gcse.every((tutor) => tutor.levels.includes('GCSE'))).toBe(true);
    expect(gcse.length).toBeLessThan(all.length);
  });

  it('filters by price range, inclusive of the bounds', () => {
    const cheap = filterTutors(all, { ...base, maxPrice: 30 });
    expect(cheap.every((tutor) => tutor.hourlyRate <= 3000)).toBe(true);
    expect(cheap.length).toBeGreaterThan(0);

    const exact = filterTutors(all, { ...base, minPrice: 22, maxPrice: 22 });
    expect(exact.map((tutor) => tutor.hourlyRate)).toEqual([2200]);
  });

  it('filters by minimum rating', () => {
    expect(
      filterTutors(all, { ...base, minRating: 4.8 }).every(
        (tutor) => tutor.rating >= 4.8,
      ),
    ).toBe(true);
  });

  it('filters to verified tutors only', () => {
    const verified = filterTutors(all, { ...base, verifiedOnly: true });
    expect(verified.every((tutor) => tutor.verified)).toBe(true);
    expect(verified.length).toBeLessThan(all.length);
  });

  it('filters by how soon a tutor is next free', () => {
    const now = Date.now();
    const soon = filterTutors(all, { ...base, availableWithinDays: 1 }, now);
    expect(
      soon.every((tutor) => new Date(tutor.nextAvailable).getTime() - now <= DAY),
    ).toBe(true);
  });

  it('combines filters rather than replacing them', () => {
    const combined = filterTutors(all, {
      ...base,
      subject: 'maths',
      level: 'GCSE',
      verifiedOnly: true,
    });
    expect(
      combined.every(
        (tutor) =>
          tutor.subjects.includes('maths') &&
          tutor.levels.includes('GCSE') &&
          tutor.verified,
      ),
    ).toBe(true);
  });

  it('returns nothing when the filters cannot be satisfied', () => {
    expect(
      filterTutors(all, { ...base, subject: 'geography', level: 'University' }),
    ).toHaveLength(0);
  });
});

describe('sortTutors', () => {
  it('orders by price ascending and descending', () => {
    const asc = sortTutors(all, 'price-asc').map((tutor) => tutor.hourlyRate);
    expect([...asc].sort((a, b) => a - b)).toEqual(asc);

    const desc = sortTutors(all, 'price-desc').map((tutor) => tutor.hourlyRate);
    expect([...desc].sort((a, b) => b - a)).toEqual(desc);
  });

  it('orders by rating, breaking ties on review count', () => {
    const sorted = sortTutors(all, 'rating');
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]!;
      const current = sorted[index]!;
      expect(
        previous.rating > current.rating ||
          (previous.rating === current.rating &&
            previous.reviewCount >= current.reviewCount),
      ).toBe(true);
    }
  });

  it('orders by soonest availability', () => {
    const times = sortTutors(all, 'soonest').map((tutor) =>
      new Date(tutor.nextAvailable).getTime(),
    );
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('puts verified tutors first when recommending', () => {
    const sorted = sortTutors(all, 'recommended');
    const firstUnverified = sorted.findIndex((tutor) => !tutor.verified);
    const lastVerified = sorted.map((tutor) => tutor.verified).lastIndexOf(true);
    expect(firstUnverified).toBeGreaterThan(lastVerified);
  });

  it('does not mutate the array it is given', () => {
    const original = [...all];
    sortTutors(all, 'price-desc');
    expect(all).toEqual(original);
  });
});

describe('countActiveFilters', () => {
  it('counts nothing for the default filters', () => {
    expect(countActiveFilters(base)).toBe(0);
  });

  it('counts each active filter once', () => {
    expect(
      countActiveFilters({
        ...base,
        query: 'maths',
        subject: 'maths',
        level: 'GCSE',
        minRating: 4.5,
        verifiedOnly: true,
      }),
    ).toBe(5);
  });

  it('treats a narrowed price range as one filter', () => {
    expect(countActiveFilters({ ...base, minPrice: 30, maxPrice: 40 })).toBe(1);
    expect(
      countActiveFilters({
        ...base,
        minPrice: priceBounds.min,
        maxPrice: priceBounds.max,
      }),
    ).toBe(0);
  });
});
