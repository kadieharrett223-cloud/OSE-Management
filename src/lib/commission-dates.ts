/**
 * Commission period utility functions
 * Commission months run from the 5th of one month to the 4th of the next month
 */

/**
 * Get the start and end dates for a commission month
 * @param yearMonth - Format "YYYY-MM" (e.g., "2026-01")
 * @returns Object with startDate and endDate in "YYYY-MM-DD" format
 * 
 * Example: "2026-01" returns { startDate: "2026-01-01", endDate: "2026-01-31" }
 */
export function getCommissionDateRange(yearMonth: string): { startDate: string; endDate: string } {
  const [year, month] = yearMonth.split("-").map(Number);
  
  // Start date is the 1st of the selected month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  
  // End date is the last day of the selected month
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  
  return { startDate, endDate };
}

/**
 * Get the current commission month in "YYYY-MM" format
 * Returns the current calendar month
 */
export function getCurrentCommissionMonth(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 0-indexed
  const year = now.getFullYear();
  
  return `${year}-${String(month).padStart(2, "0")}`;
}
