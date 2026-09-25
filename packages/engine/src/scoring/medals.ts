export type Medal = 'gold' | 'silver' | 'bronze' | null;

/** Piano Marvel style medal boundaries. */
export const MEDAL_THRESHOLDS = { bronze: 80, silver: 90, gold: 96 } as const;

export function medalFor(score: number | null | undefined): Medal {
  if (score == null) return null;
  if (score >= MEDAL_THRESHOLDS.gold) return 'gold';
  if (score >= MEDAL_THRESHOLDS.silver) return 'silver';
  if (score >= MEDAL_THRESHOLDS.bronze) return 'bronze';
  return null;
}

export function passed(score: number | null | undefined, passScore: number = MEDAL_THRESHOLDS.bronze): boolean {
  return score != null && score >= passScore;
}
