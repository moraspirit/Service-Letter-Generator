export const CERTIFICATE_TIME_ZONE = "Asia/Colombo";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function format(year: number, month: number, day: number): string {
  return `${ordinal(day)} of ${MONTHS[month - 1]} ${year}`;
}

/**
 * "28th of April 2025". A `YYYY-MM-DD` string is a calendar date and is formatted
 * as written; a `Date` (an instant, e.g. the issue timestamp) is converted to
 * Asia/Colombo first.
 */
export function formatDate(value: string | Date): string {
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!m) throw new Error(`formatDate: "${value}" is not a YYYY-MM-DD date`);
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`formatDate: "${value}" is not a valid date`);
    }
    return format(year, month, day);
  }
  if (Number.isNaN(value.getTime())) throw new Error("formatDate: invalid Date");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CERTIFICATE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return format(get("year"), get("month"), get("day"));
}
