import { describe, expect, it } from 'vitest';
import type { CalendarConfig } from '../types';
import {
  addDays,
  countWorkingDays,
  diffInDays,
  finishDate,
  isWorkingDay,
  nextWorkingDay,
  parseISODate,
  previousWorkingDay,
  shiftWorkingDays,
  toISODate,
} from './date';

const WORKWEEK: CalendarConfig = { weekendDays: [0, 6], holidays: [] };

const WITH_HOLIDAY: CalendarConfig = {
  weekendDays: [0, 6],
  holidays: [
    { id: 'ny', date: '2026-01-01', name: 'Tahun Baru' },
    { id: 'holiday', date: '2026-01-08', name: 'Libur Khusus' },
  ],
};

describe('utilitas tanggal', () => {
  it('parse dan format ISO bolak-balik konsisten', () => {
    expect(toISODate(parseISODate('2026-01-05'))).toBe('2026-01-05');
    expect(toISODate(parseISODate('2026-12-31'))).toBe('2026-12-31');
    expect(toISODate(parseISODate('2024-02-29'))).toBe('2024-02-29');
  });

  it('menjumlah hari kalender melewati batas bulan dan tahun', () => {
    expect(toISODate(addDays(parseISODate('2026-01-31'), 1))).toBe('2026-02-01');
    expect(toISODate(addDays(parseISODate('2026-12-31'), 1))).toBe('2027-01-01');
    expect(diffInDays(parseISODate('2026-01-01'), parseISODate('2026-01-11'))).toBe(10);
    expect(diffInDays(parseISODate('2026-01-11'), parseISODate('2026-01-01'))).toBe(-10);
  });
});

describe('hari kerja', () => {
  it('menganggap Sabtu & Minggu sebagai akhir pekan', () => {
    expect(isWorkingDay(parseISODate('2026-01-05'), WORKWEEK)).toBe(true); // Senin
    expect(isWorkingDay(parseISODate('2026-01-10'), WORKWEEK)).toBe(false); // Sabtu
    expect(isWorkingDay(parseISODate('2026-01-11'), WORKWEEK)).toBe(false); // Minggu
  });

  it('menganggap hari libur khusus sebagai hari non-kerja', () => {
    expect(isWorkingDay(parseISODate('2026-01-01'), WITH_HOLIDAY)).toBe(false); // Kamis
    expect(isWorkingDay(parseISODate('2026-01-02'), WITH_HOLIDAY)).toBe(true); // Jumat
    expect(isWorkingDay(parseISODate('2026-01-08'), WITH_HOLIDAY)).toBe(false); // Kamis libur
  });

  it('nextWorkingDay melompati akhir pekan dan hari libur', () => {
    expect(toISODate(nextWorkingDay(parseISODate('2026-01-10'), WORKWEEK))).toBe('2026-01-12');
    expect(toISODate(nextWorkingDay(parseISODate('2026-01-01'), WITH_HOLIDAY))).toBe('2026-01-02');
    expect(toISODate(nextWorkingDay(parseISODate('2026-01-05'), WORKWEEK))).toBe('2026-01-05');
  });

  it('previousWorkingDay melompati akhir pekan ke belakang', () => {
    expect(toISODate(previousWorkingDay(parseISODate('2026-01-11'), WORKWEEK))).toBe('2026-01-09');
    expect(toISODate(previousWorkingDay(parseISODate('2026-01-01'), WITH_HOLIDAY))).toBe(
      '2025-12-31',
    );
    expect(toISODate(previousWorkingDay(parseISODate('2026-01-02'), WITH_HOLIDAY))).toBe(
      '2026-01-02',
    );
  });
});

describe('shiftWorkingDays', () => {
  it('amount 0 mengembalikan hari kerja terdekat', () => {
    expect(toISODate(shiftWorkingDays(parseISODate('2026-01-05'), 0, WORKWEEK))).toBe('2026-01-05');
    expect(toISODate(shiftWorkingDays(parseISODate('2026-01-10'), 0, WORKWEEK))).toBe('2026-01-12');
  });

  it('amount positif menghitung maju dalam hari kerja', () => {
    // Senin + 1 hari kerja = Selasa
    expect(toISODate(shiftWorkingDays(parseISODate('2026-01-05'), 1, WORKWEEK))).toBe('2026-01-06');
    // Jumat + 1 hari kerja = Senin (melewati akhir pekan)
    expect(toISODate(shiftWorkingDays(parseISODate('2026-01-09'), 1, WORKWEEK))).toBe('2026-01-12');
    expect(toISODate(shiftWorkingDays(parseISODate('2026-01-05'), 5, WORKWEEK))).toBe('2026-01-12');
  });

  it('amount negatif menghitung mundur dalam hari kerja', () => {
    expect(toISODate(shiftWorkingDays(parseISODate('2026-01-12'), -1, WORKWEEK))).toBe('2026-01-09');
    expect(toISODate(shiftWorkingDays(parseISODate('2026-01-05'), -1, WORKWEEK))).toBe('2026-01-02');
  });
});

describe('countWorkingDays dan finishDate', () => {
  it('menghitung hari kerja inklusif pada rentang', () => {
    // Senin 5 Jan — Jumat 9 Jan = 5 hari kerja
    expect(countWorkingDays(parseISODate('2026-01-05'), parseISODate('2026-01-09'), WORKWEEK)).toBe(5);
    // Sepanjang satu minggu penuh = 5 hari kerja
    expect(countWorkingDays(parseISODate('2026-01-05'), parseISODate('2026-01-11'), WORKWEEK)).toBe(5);
    // Rentang mundur = 0
    expect(countWorkingDays(parseISODate('2026-01-09'), parseISODate('2026-01-05'), WORKWEEK)).toBe(0);
    // Termasuk hari libur khusus
    expect(
      countWorkingDays(parseISODate('2026-01-05'), parseISODate('2026-01-09'), WITH_HOLIDAY),
    ).toBe(4);
  });

  it('finishDate menghasilkan hari kerja ke-N', () => {
    expect(finishDate('2026-01-05', 1, WORKWEEK)).toBe('2026-01-05');
    expect(finishDate('2026-01-05', 3, WORKWEEK)).toBe('2026-01-07');
    expect(finishDate('2026-01-05', 5, WORKWEEK)).toBe('2026-01-09');
    expect(finishDate('2026-01-05', 6, WORKWEEK)).toBe('2026-01-12');
    // mulai pada hari libur → otomatis digeser ke hari kerja berikutnya
    expect(finishDate('2026-01-01', 1, WITH_HOLIDAY)).toBe('2026-01-02');
  });

  it('tidak berputar tanpa akhir bila semua hari disetel akhir pekan', () => {
    const allWeekend: CalendarConfig = { weekendDays: [0, 1, 2, 3, 4, 5, 6], holidays: [] };
    expect(toISODate(nextWorkingDay(parseISODate('2026-01-05'), allWeekend))).toBe('2026-01-05');
    expect(finishDate('2026-01-05', 3, allWeekend)).toBe('2026-01-07');
  });
});
