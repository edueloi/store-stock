/**
 * Returns today's date as a Date object at midnight UTC, mapped to the
 * local calendar day, so Prisma @db.Date stores the correct day.
 */
export function localDateString(): Date {
  const d = new Date();
  // Build midnight of today in local time as a UTC Date so Prisma accepts it
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
