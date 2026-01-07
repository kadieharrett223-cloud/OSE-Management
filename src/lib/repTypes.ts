// Configuration for sales rep types and bonus thresholds

export const SALARY_REPS = ["SC", "sc", "CR", "cr"] as const;
export const COMMISSIONED_REPS = ["KLH", "klh", "WL", "wl", "Wholesale Lifts", "RT", "rt", "Jared", "jared"] as const;

// Bonus threshold for salary workers
export const SALARY_BONUS_THRESHOLD = 150000;

export function isSalaryRep(repName: string): boolean {
  const normalized = repName.trim().toUpperCase();
  return SALARY_REPS.some(r => r.toUpperCase() === normalized);
}

export function isCommissionedRep(repName: string): boolean {
  const normalized = repName.trim().toUpperCase();
  return COMMISSIONED_REPS.some(r => r.toUpperCase() === normalized);
}
