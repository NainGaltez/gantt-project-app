import { describe, expect, it } from 'vitest';
import type { CalendarConfig, Dependency, ProjectData, Task } from '../types';
import { PROJECT_VERSION } from '../types';
import {
  computePertLevels,
  computeSchedule,
  wouldCreateCycle,
} from './schedule';

const CALENDAR: CalendarConfig = { weekendDays: [0, 6], holidays: [] };

function makeTask(
  id: string,
  startDate: string,
  duration: number,
  extra: Partial<Task> = {},
): Task {
  return {
    id,
    name: id,
    description: '',
    startDate,
    duration,
    progress: 0,
    priority: 'Medium',
    color: '#2563eb',
    parentId: null,
    resourceIds: [],
    ...extra,
  };
}

function makeProject(tasks: Task[], dependencies: Dependency[] = []): ProjectData {
  return {
    version: PROJECT_VERSION,
    projectName: 'Proyek Uji',
    tasks,
    dependencies,
    resources: [],
    calendar: CALENDAR,
  };
}

function dep(
  predecessorId: string,
  successorId: string,
  type: Dependency['type'] = 'FS',
  lag = 0,
): Dependency {
  return {
    id: `dep_${predecessorId}_${successorId}_${type}`,
    predecessorId,
    successorId,
    type,
    lag,
  };
}

describe('forward & backward pass', () => {
  it('FS tanpa lag menjadwalkan successor pada hari kerja berikutnya', () => {
    const result = computeSchedule(
      makeProject(
        [makeTask('a', '2026-01-05', 3), makeTask('b', '2026-01-05', 2)],
        [dep('a', 'b')],
      ),
    );

    expect(result.byId.a.earlyStart).toBe('2026-01-05'); // Senin
    expect(result.byId.a.earlyFinish).toBe('2026-01-07'); // Rabu
    expect(result.byId.b.earlyStart).toBe('2026-01-08'); // Kamis
    expect(result.byId.b.earlyFinish).toBe('2026-01-09'); // Jumat
    expect(result.projectFinish).toBe('2026-01-09');
    expect(result.projectDuration).toBe(5);
  });

  it('FS dengan lag menambahkan hari kerja jeda', () => {
    const result = computeSchedule(
      makeProject(
        [makeTask('a', '2026-01-05', 3), makeTask('b', '2026-01-05', 1)],
        [dep('a', 'b', 'FS', 2)],
      ),
    );

    // Selesai Rabu + lag 2 hari kerja → mulai Senin berikutnya
    expect(result.byId.b.earlyStart).toBe('2026-01-12');
    expect(result.byId.b.earlyFinish).toBe('2026-01-12');
  });

  it('SS tanpa lag membuat successor mulai bersamaan dengan predecessor', () => {
    const result = computeSchedule(
      makeProject(
        [makeTask('a', '2026-01-05', 5), makeTask('b', '2026-01-05', 2)],
        [dep('a', 'b', 'SS', 0)],
      ),
    );

    expect(result.byId.b.earlyStart).toBe('2026-01-05');
    expect(result.byId.b.earlyFinish).toBe('2026-01-06');
    expect(result.byId.a.earlyFinish).toBe('2026-01-09');
  });

  it('SS dengan lag menggeser start sejumlah hari kerja', () => {
    const result = computeSchedule(
      makeProject(
        [makeTask('a', '2026-01-05', 5), makeTask('b', '2026-01-05', 2)],
        [dep('a', 'b', 'SS', 2)],
      ),
    );

    expect(result.byId.b.earlyStart).toBe('2026-01-07'); // Rabu = Senin + 2 hari kerja
    expect(result.byId.b.earlyFinish).toBe('2026-01-08');
  });

  it('tanggal mulai manual tetap menjadi batas terawal (constraint)', () => {
    const result = computeSchedule(
      makeProject([
        makeTask('a', '2026-01-05', 2),
        makeTask('b', '2026-01-15', 2),
      ]),
    );

    expect(result.byId.b.earlyStart).toBe('2026-01-15');
    expect(result.projectFinish).toBe('2026-01-16');
  });

  it('menghormati hari libur khusus saat menjadwalkan', () => {
    const project = makeProject([makeTask('a', '2026-01-01', 2)]);
    project.calendar = {
      weekendDays: [0, 6],
      holidays: [{ id: 'libur', date: '2026-01-01', name: 'Tahun Baru' }],
    };

    const result = computeSchedule(project);
    expect(result.byId.a.earlyStart).toBe('2026-01-02');
    expect(result.byId.a.earlyFinish).toBe('2026-01-05'); // Jumat + Senin
  });
});

describe('jalur kritis (critical path)', () => {
  it('menandai rantai dengan total float 0 dan mengabaikan tugas paralel', () => {
    const result = computeSchedule(
      makeProject(
        [
          makeTask('a', '2026-01-05', 3),
          makeTask('b', '2026-01-05', 2),
          makeTask('c', '2026-01-05', 1),
        ],
        [dep('a', 'b')],
      ),
    );

    expect(result.byId.a.isCritical).toBe(true);
    expect(result.byId.b.isCritical).toBe(true);
    expect(result.byId.c.isCritical).toBe(false);
    expect(result.byId.c.totalFloat).toBeGreaterThan(0);
    expect(result.criticalPath).toEqual(['a', 'b']);
    expect(result.byId.a.totalFloat).toBe(0);
  });

  it('menghitung float sebagai hari kerja dari early ke late start', () => {
    const result = computeSchedule(
      makeProject([
        makeTask('a', '2026-01-05', 1),
        makeTask('b', '2026-01-05', 5),
      ]),
    );

    // Durasi proyek = 5 hari kerja; tugas 1 hari kerja punya float 4 hari kerja.
    expect(result.projectDuration).toBe(5);
    expect(result.byId.a.totalFloat).toBe(4);
    expect(result.byId.b.totalFloat).toBe(0);
    expect(result.criticalPath).toEqual(['b']);
  });

  it('memperhitungkan jeda dependensi pada perhitungan late pass', () => {
    const result = computeSchedule(
      makeProject(
        [makeTask('a', '2026-01-05', 1), makeTask('b', '2026-01-05', 3)],
        [dep('a', 'b', 'FS', 2)],
      ),
    );

    // a harus selesai 2 hari kerja sebelum b mulai → a tetap kritis (float 0).
    expect(result.byId.a.earlyStart).toBe('2026-01-05');
    expect(result.byId.a.lateStart).toBe('2026-01-05');
    expect(result.byId.a.isCritical).toBe(true);
  });
});

describe('siklus dependensi', () => {
  it('mendeteksi siklus tanpa membuat perhitungan menggantung', () => {
    const result = computeSchedule(
      makeProject(
        [makeTask('a', '2026-01-05', 2), makeTask('b', '2026-01-05', 2)],
        [dep('a', 'b'), dep('b', 'a')],
      ),
    );

    expect(result.hasCycle).toBe(true);
    expect(Object.keys(result.byId)).toHaveLength(2);
  });

  it('wouldCreateCycle menolak edge yang menutup siklus', () => {
    const dependencies = [dep('a', 'b'), dep('b', 'c')];
    expect(wouldCreateCycle(dependencies, { predecessorId: 'c', successorId: 'a' })).toBe(true);
    expect(wouldCreateCycle(dependencies, { predecessorId: 'a', successorId: 'd' })).toBe(false);
    expect(wouldCreateCycle(dependencies, { predecessorId: 'a', successorId: 'a' })).toBe(true);
  });
});

describe('sub-tugas (parent-child) & roll-up', () => {
  it('tugas induk menerima jadwal roll-up dari sub-tugasnya', () => {
    const result = computeSchedule(
      makeProject([
        makeTask('parent', '2026-01-05', 1),
        makeTask('child1', '2026-01-05', 2, { parentId: 'parent' }),
        makeTask('child2', '2026-01-08', 3, { parentId: 'parent' }),
      ]),
    );

    expect(result.byId.child1.earlyStart).toBe('2026-01-05');
    expect(result.byId.child2.earlyFinish).toBe('2026-01-12');
    expect(result.byId.parent.isSummary).toBe(true);
    expect(result.byId.parent.earlyStart).toBe('2026-01-05');
    expect(result.byId.parent.earlyFinish).toBe('2026-01-12');
    expect(result.byId.parent.duration).toBe(6);
  });

  it('tugas induk ikut kritis bila ada sub-tugas kritis', () => {
    const result = computeSchedule(
      makeProject([
        makeTask('parent', '2026-01-05', 1),
        makeTask('leaf1', '2026-01-05', 5, { parentId: 'parent' }),
        makeTask('solo', '2026-01-05', 2),
      ]),
    );

    expect(result.byId.leaf1.isCritical).toBe(true);
    expect(result.byId.parent.isSummary).toBe(true);
    expect(result.byId.parent.isCritical).toBe(true);
    expect(result.byId.solo.isCritical).toBe(false);
  });

  it('dependensi yang menyentuh tugas induk diabaikan (hanya daun yang dijadwalkan)', () => {
    const result = computeSchedule(
      makeProject(
        [
          makeTask('parentA', '2026-01-05', 1),
          makeTask('childA', '2026-01-05', 2, { parentId: 'parentA' }),
          makeTask('parentB', '2026-01-05', 1),
          makeTask('childB', '2026-01-05', 2, { parentId: 'parentB' }),
        ],
        [dep('parentA', 'parentB')],
      ),
    );

    // Kedua anak tetap bebas (tidak digeser) karena dependensi menyentuh induk.
    expect(result.byId.childB.earlyStart).toBe('2026-01-05');
    expect(result.order).toEqual(['childA', 'childB']);
  });
});

describe('diagram PERT', () => {
  it('memberi level berdasarkan jalur terpanjang dari predecessor', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const dependencies = [dep('a', 'b'), dep('b', 'c'), dep('a', 'c')];
    const levels = computePertLevels(ids, dependencies);

    expect(levels.get('a')).toBe(0);
    expect(levels.get('b')).toBe(1);
    expect(levels.get('c')).toBe(2);
    expect(levels.get('d')).toBe(0);
  });
});

describe('proyek kosong', () => {
  it('mengembalikan hasil kosong tanpa error', () => {
    const result = computeSchedule(makeProject([]));
    expect(result.projectStart).toBeNull();
    expect(result.projectFinish).toBeNull();
    expect(result.projectDuration).toBe(0);
    expect(result.criticalPath).toEqual([]);
  });
});
