import type { CalendarConfig, Holiday, ISODate } from '../types';

/**
 * Utilitas tanggal untuk penjadwalan berbasis HARI KERJA.
 * Semua tanggal memakai waktu lokal pada tengah malam agar stabil lintas zona waktu.
 */

const MS_PER_DAY = 86_400_000;
const MAX_ITERATION = 40_000;

export const WEEKDAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export function parseISODate(value: ISODate): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const y = Number.isFinite(year) ? year : 1970;
  const m = Number.isFinite(month) ? month : 1;
  const d = Number.isFinite(day) ? day : 1;
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

/** Menambah sejumlah hari kalender (aman terhadap pergantian bulan/tahun). */
export function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

/** Selisih hari kalender (b - a). */
export function diffInDays(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / MS_PER_DAY);
}

export function minDate(a: Date, b: Date): Date {
  return diffInDays(a, b) >= 0 ? a : b;
}

export function maxDate(a: Date, b: Date): Date {
  return diffInDays(a, b) >= 0 ? b : a;
}

export function compareISO(a: ISODate, b: ISODate): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Bila seluruh hari diatur sebagai akhir pekan, kalender dianggap tidak valid
 * sehingga semua hari diperlakukan sebagai hari kerja (mencegah perulangan tanpa akhir).
 */
function calendarHasNoWorkingDay(calendar: CalendarConfig): boolean {
  return calendar.weekendDays.length >= 7;
}

export function isWeekend(date: Date, calendar: CalendarConfig): boolean {
  if (calendarHasNoWorkingDay(calendar)) return false;
  return calendar.weekendDays.includes(date.getDay());
}

export function holidayOn(date: Date, calendar: CalendarConfig): Holiday | undefined {
  const iso = toISODate(date);
  return calendar.holidays.find((holiday) => holiday.date === iso);
}

export function isHoliday(date: Date, calendar: CalendarConfig): boolean {
  return Boolean(holidayOn(date, calendar));
}

export function isWorkingDay(date: Date, calendar: CalendarConfig): boolean {
  return !isWeekend(date, calendar) && !isHoliday(date, calendar);
}

/** Hari kerja pertama pada/atau setelah tanggal yang diberikan. */
export function nextWorkingDay(date: Date, calendar: CalendarConfig): Date {
  let cursor = date;
  for (let i = 0; i < MAX_ITERATION; i += 1) {
    if (isWorkingDay(cursor, calendar)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

/** Hari kerja terakhir pada/atau sebelum tanggal yang diberikan. */
export function previousWorkingDay(date: Date, calendar: CalendarConfig): Date {
  let cursor = date;
  for (let i = 0; i < MAX_ITERATION; i += 1) {
    if (isWorkingDay(cursor, calendar)) return cursor;
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

/**
 * Geser `amount` hari kerja ke depan.
 * - `amount = 0` → hari kerja terdekat pada/atau setelah `date` (tanpa geser).
 * - `amount = 1` → satu hari kerja setelah hari kerja terdekat.
 */
export function shiftWorkingDays(date: Date, amount: number, calendar: CalendarConfig): Date {
  const steps = Math.round(amount);
  if (steps === 0) return nextWorkingDay(date, calendar);

  let cursor = steps > 0 ? nextWorkingDay(date, calendar) : previousWorkingDay(date, calendar);
  let remaining = Math.abs(steps);
  const direction = steps > 0 ? 1 : -1;
  let guard = 0;
  while (remaining > 0 && guard < MAX_ITERATION) {
    cursor = addDays(cursor, direction);
    guard += 1;
    if (isWorkingDay(cursor, calendar)) remaining -= 1;
  }
  return cursor;
}

/** Cerminan {@link shiftWorkingDays}: geser `amount` hari kerja ke belakang. */
export function shiftWorkingDaysBack(date: Date, amount: number, calendar: CalendarConfig): Date {
  return shiftWorkingDays(date, -Math.round(amount), calendar);
}

/** Jumlah hari kerja pada rentang inklusif `from`..`to`. */
export function countWorkingDays(from: Date, to: Date, calendar: CalendarConfig): number {
  if (diffInDays(from, to) < 0) return 0;
  let count = 0;
  let cursor = from;
  let guard = 0;
  while (diffInDays(cursor, to) >= 0 && guard < MAX_ITERATION) {
    if (isWorkingDay(cursor, calendar)) count += 1;
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return count;
}

/** Durasi hari kerja dari `start` sampai `end` (inklusif), minimal 1 hari kerja. */
export function workingDuration(start: ISODate, end: ISODate, calendar: CalendarConfig): number {
  const total = countWorkingDays(parseISODate(start), parseISODate(end), calendar);
  return Math.max(1, total);
}

/** Tanggal selesai dari sebuah tanggal mulai + durasi hari kerja. */
export function finishDate(start: ISODate, duration: number, calendar: CalendarConfig): ISODate {
  const startDate = nextWorkingDay(parseISODate(start), calendar);
  return toISODate(shiftWorkingDays(startDate, Math.max(1, Math.round(duration)) - 1, calendar));
}

export function addWorkingDaysISO(start: ISODate, amount: number, calendar: CalendarConfig): ISODate {
  return toISODate(shiftWorkingDays(parseISODate(start), amount, calendar));
}

/** Daftar semua tanggal (kalender) pada rentang inklusif. */
export function eachDay(from: ISODate, to: ISODate): Date[] {
  const start = parseISODate(from);
  const end = parseISODate(to);
  const total = diffInDays(start, end);
  if (total < 0) return [];
  const days: Date[] = [];
  for (let i = 0; i <= total && i < MAX_ITERATION; i += 1) days.push(addDays(start, i));
  return days;
}

export function formatShort(iso: ISODate): string {
  if (!iso) return '-';
  const date = parseISODate(iso);
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatLong(iso: ISODate): string {
  if (!iso) return '-';
  const date = parseISODate(iso);
  return `${WEEKDAY_SHORT[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatInputDate(iso: ISODate): string {
  return iso ? iso.slice(0, 10) : '';
}

export function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return `Rp ${safe.toLocaleString('id-ID')}`;
}

export function formatEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
