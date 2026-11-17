function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The device-local date and time as a datetime-local input value (YYYY-MM-DDTHH:mm). */
export function toDateTimeLocal(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DATE_TIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Reads a datetime-local value as device-local time; null when it is empty or not a real date and time. */
export function fromDateTimeLocal(value: string): Date | null {
  const match = DATE_TIME_LOCAL.exec(value);
  if (!match) return null;
  const [year, month, day, hours, minutes] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  // new Date rolls over out-of-range parts (2月30日 -> 3月2日); such a value is not a real date.
  const real = date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hours && date.getMinutes() === minutes;
  return real ? date : null;
}

/** A round's start time for the list, e.g. 2026/11/18 10:30, in the device's time zone. */
export function formatStartedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
