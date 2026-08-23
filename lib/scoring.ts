import { type Rating, ratingForScore, RATING_LABELS } from '@/schemas/audit';

/**
 * Presentation mapping for scores.
 *
 * Kept out of the components so that the score dial, the category cards, the
 * report header and the OG image all agree on what "74" looks like.
 */
export interface RatingPresentation {
  rating: Rating;
  label: string;
  /** CSS custom property holding the foreground colour. */
  color: string;
  /** CSS custom property holding the tinted background. */
  background: string;
}

const PRESENTATION: Record<Rating, Omit<RatingPresentation, 'rating' | 'label'>> = {
  excellent: {
    color: 'var(--color-score-excellent)',
    background: 'var(--color-score-excellent-bg)',
  },
  good: {
    color: 'var(--color-score-good)',
    background: 'var(--color-score-good-bg)',
  },
  needsImprovement: {
    color: 'var(--color-score-mid)',
    background: 'var(--color-score-mid-bg)',
  },
  poor: {
    color: 'var(--color-score-poor)',
    background: 'var(--color-score-poor-bg)',
  },
};

export function ratingPresentation(score: number): RatingPresentation {
  const rating = ratingForScore(score);
  return { rating, label: RATING_LABELS[rating], ...PRESENTATION[rating] };
}
