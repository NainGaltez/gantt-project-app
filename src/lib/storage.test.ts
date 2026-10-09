import { describe, expect, it } from 'vitest';
import { normalizeProject } from './storage';
import { createSeedProject } from '../data/seed';
import { PROJECT_VERSION } from '../types';

const FALLBACK = '2026-01-05';

describe('normalizeProject', () => {
  it('mengembalikan null untuk input yang bukan objek', () => {
    expect(normalizeProject(null, FALLBACK)).toBeNull();
    expect(normalizeProject('bukan objek', FALLBACK)).toBeNull();
    expect(normalizeProject(42, FALLBACK)).toBeNull();
    expect(normalizeProject([], FALLBACK)).toBeNull();
  });

  it('membuang tugas tanpa nama dan menormalkan nilai numerik', () => {
    const result = normalizeProject(
      {
        projectName: '  Proyek  ',
        tasks: [
          { id: 'a', name: '  Tugas A  ', startDate: 'bukan-tanggal', duration: 0, progress: 250 },
          { id: 'b', name: '', startDate: '2026-01-05', duration: 3 },
          { id: 'c', name: 'Tugas C', startDate: '2026-01-05', duration: -5, priority: 'SangatTinggi' },
        ],
      },
      FALLBACK,
    );

    expect(result).not.toBeNull();
    expect(result?.projectName).toBe('Proyek');
    expect(result?.version).toBe(PROJECT_VERSION);
    expect(result?.tasks).toHaveLength(2);
    expect(result?.tasks[0].name).toBe('Tugas A');
    expect(result?.tasks[0].startDate).toBe(FALLBACK);
    expect(result?.tasks[0].duration).toBe(1);
    expect(result?.tasks[0].progress).toBe(100);
    expect(result?.tasks[1].duration).toBe(1);
    expect(result?.tasks[1].priority).toBe('Medium');
  });

  it('membuang dependensi yang tidak valid atau menunjuk id asing', () => {
    const result = normalizeProject(
      {
        tasks: [
          { id: 'a', name: 'A', startDate: '2026-01-05', duration: 2 },
          { id: 'b', name: 'B', startDate: '2026-01-05', duration: 2 },
        ],
        dependencies: [
          { id: 'd1', predecessorId: 'a', successorId: 'b', type: 'FS', lag: 1 },
          { id: 'd2', predecessorId: 'a', successorId: 'a', type: 'FS', lag: 0 },
          { id: 'd3', predecessorId: 'a', successorId: 'tidak-ada', type: 'FS', lag: 0 },
          { id: 'd4', predecessorId: '', successorId: 'b', type: 'SS', lag: -3 },
        ],
      },
      FALLBACK,
    );

    expect(result?.dependencies).toHaveLength(1);
    expect(result?.dependencies[0].id).toBe('d1');
    expect(result?.dependencies[0].lag).toBe(1);
  });

  it('membersihkan alokasi resource dan parentId yang menggantung', () => {
    const result = normalizeProject(
      {
        tasks: [
          {
            id: 'a',
            name: 'A',
            startDate: '2026-01-05',
            duration: 2,
            parentId: 'hilang',
            resourceIds: ['ada', 'hilang'],
          },
        ],
        resources: [{ id: 'ada', name: 'Budi', email: 'budi@example.com', role: 'QA', salary: 5000000 }],
      },
      FALLBACK,
    );

    expect(result?.tasks[0].parentId).toBeNull();
    expect(result?.tasks[0].resourceIds).toEqual(['ada']);
    expect(result?.resources).toHaveLength(1);
  });

  it('menormalkan kalender akhir pekan & hari libur', () => {
    const result = normalizeProject(
      {
        calendar: {
          weekendDays: [6, 0, 6, 9, -1, 'x'],
          holidays: [
            { id: 'h1', date: '2026-08-17', name: 'Kemerdekaan' },
            { id: 'h2', date: 'bukan', name: '' },
            'rusak',
          ],
        },
      },
      FALLBACK,
    );

    expect(result?.calendar.weekendDays).toEqual([0, 6]);
    expect(result?.calendar.holidays).toHaveLength(1);
    expect(result?.calendar.holidays[0].name).toBe('Kemerdekaan');
  });

  it('memberi default weekend bila kalender tidak ada', () => {
    const result = normalizeProject({ tasks: [] }, FALLBACK);
    expect(result?.calendar.weekendDays).toEqual([0, 6]);
  });
});

describe('seed data', () => {
  it('membuat seed proyek yang valid untuk dijadwalkan', () => {
    const seed = createSeedProject('2026-01-05');

    expect(seed.tasks.length).toBeGreaterThan(10);
    expect(seed.dependencies.length).toBeGreaterThan(5);
    expect(seed.resources.length).toBeGreaterThan(0);
    expect(seed.calendar.weekendDays).toEqual([0, 6]);
    expect(seed.calendar.holidays.length).toBeGreaterThan(0);
    expect(seed.tasks.some((task) => task.parentId !== null)).toBe(true);
    expect(seed.dependencies.every((dep) => dep.lag >= 0)).toBe(true);
  });

  it('menghasilkan objek baru setiap kali dipanggil', () => {
    const first = createSeedProject('2026-01-05');
    const second = createSeedProject('2026-01-05');
    expect(first).not.toBe(second);
    expect(first.calendar.holidays).not.toBe(second.calendar.holidays);
    expect(first.tasks).toHaveLength(second.tasks.length);
  });
});
