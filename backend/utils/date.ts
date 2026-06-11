/**
 * Returns today's date as a "YYYY-MM-DD" string using the server's local
 * timezone (not UTC), so MySQL @db.Date stores the correct calendar day
 * regardless of what time of day the sale happens.
 */
export function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
