/**
 * Commission period utility functions
 * Commission months run from the 5th of one month to the 4th of the next month
 */

/**
 * Get the start and end dates for a commission month
 * @param yearMonth - Format "YYYY-MM" (e.g., "2026-01")
 * @returns Object with startDate and endDate in "YYYY-MM-DD" format
 * 
 * Example: "2026-01" returns { startDate: "2026-01-05", endDate: "2026-02-04" }
 */
export function getCommissionDateRange(yearMonth: string): { startDate: string; endDate: string } {
  const [year, month] = yearMonth.split("-").map(Number);
  
  // Start date is the 5th of the selected month
  const startDate = `${year}-${String(month).padStart(2, "0")}-05`;
  
  // End date is the 4th of the next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-04`;
  
  return { startDate, endDate };
}

/**
 * Get the current commission month in "YYYY-MM" format
 * If today is before the 5th, returns previous month
 * If today is on or after the 5th, returns current month
 */
export function getCurrentCommissionMonth(): string {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1; // 0-indexed
  const year = now.getFullYear();
  
  // If before the 5th, use previous month
  if (day < 5) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  }
  
  return `${year}-${String(month).padStart(2, "0")}`;
}
