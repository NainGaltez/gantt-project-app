import type { CalendarConfig, Dependency, ProjectData, Resource, Task } from '../types';
import { PROJECT_VERSION, TASK_COLORS } from '../types';
import { addDays, addWorkingDaysISO, finishDate, nextWorkingDay, toISODate } from '../lib/date';

/**
 * Data contoh (seed): proyek pengembangan platform e-commerce.
 * Jadwal memakai hari kerja Senin–Jumat, plus hari libur khusus.
 */

export const SEED_WEEKEND_DAYS = [0, 6];

/** Kalender dasar (akhir pekan saja) dipakai saat menghitung tanggal contoh. */
export const BASE_CALENDAR: CalendarConfig = {
  weekendDays: [...SEED_WEEKEND_DAYS],
  holidays: [],
};

/**
 * Hari libur khusus dibuat relatif terhadap tanggal mulai proyek agar selalu
 * berada di dalam rentang Gantt Chart dan benar-benar memengaruhi penjadwalan.
 */
export function seedHolidays(projectStart: string): CalendarConfig['holidays'] {
  const at = (workingDay: number): string => finishDate(projectStart, workingDay, BASE_CALENDAR);
  return [
    { id: 'holiday_nasional', date: at(7), name: 'Hari Libur Nasional' },
    { id: 'holiday_cuti', date: at(16), name: 'Cuti Bersama' },
    { id: 'holiday_akhir', date: at(33), name: 'Libur Akhir Tahun' },
  ];
}

export const SEED_CALENDAR: CalendarConfig = {
  weekendDays: [...SEED_WEEKEND_DAYS],
  holidays: [],
};

interface TaskSpec {
  key: string;
  name: string;
  start: string;
  duration: number;
  priority?: Task['priority'];
  color?: string;
  parent?: string;
  resources?: string[];
  progress?: number;
}

/** Tanggal mulai proyek contoh: hari kerja pertama pada/sekarang, lalu dinaikkan ke Senin. */
export function defaultProjectStart(calendar: CalendarConfig = SEED_CALENDAR): string {
  const start = nextWorkingDay(new Date(), calendar);
  const offset = (8 - start.getDay()) % 7;
  return toISODate(addDays(start, offset));
}

function seedTasks(projectStart: string): Task[] {
  const c = SEED_CALENDAR;
  const at = (days: number): string => addWorkingDaysISO(projectStart, days, c);

  const specs: TaskSpec[] = [
    { key: 'init', name: 'Inisiasi Proyek', start: projectStart, duration: 3, priority: 'High', color: TASK_COLORS[6] },
    { key: 'charter', name: 'Penyusunan Project Charter', start: projectStart, duration: 2, parent: 'init', resources: ['res2'], progress: 100 },
    { key: 'kickoff', name: 'Kick-off Meeting dengan Stakeholder', start: at(2), duration: 1, parent: 'init', resources: ['res1', 'res3'] },

    { key: 'analysis', name: 'Analisis Kebutuhan', start: at(4), duration: 8, priority: 'High', color: TASK_COLORS[7] },
    { key: 'wawancara', name: 'Wawancara Pengguna & Stakeholder', start: at(4), duration: 4, parent: 'analysis', resources: ['res3'] },
    { key: 'srs', name: 'Penulisan Dokumen SRS', start: at(6), duration: 5, parent: 'analysis', resources: ['res3', 'res4'], progress: 40 },

    { key: 'design', name: 'Desain Produk', start: at(12), duration: 10, color: TASK_COLORS[3] },
    { key: 'ux', name: 'Desain UX Flow & Wireframe', start: at(12), duration: 4, parent: 'design', resources: ['res1'], progress: 60 },
    { key: 'ui', name: 'Desain UI High-Fidelity', start: at(15), duration: 5, parent: 'design', resources: ['res1', 'res2'] },

    { key: 'dev', name: 'Pengembangan', start: at(20), duration: 22, priority: 'High', color: TASK_COLORS[0] },
    { key: 'infra', name: 'Setup Infrastruktur & CI/CD', start: at(20), duration: 3, parent: 'dev', resources: ['res4'] },
    { key: 'backend', name: 'Pengembangan Backend API', start: at(20), duration: 15, parent: 'dev', resources: ['res4', 'res2'], progress: 25 },
    { key: 'frontend', name: 'Pengembangan Frontend Web', start: at(22), duration: 14, parent: 'dev', resources: ['res3', 'res1'] },

    { key: 'test', name: 'Pengujian & QA', start: at(38), duration: 12, priority: 'High', color: TASK_COLORS[8] },
    { key: 'utest', name: 'Pengujian Fungsional & Regression', start: at(38), duration: 7, parent: 'test', resources: ['res4', 'res3'] },
    { key: 'uat', name: 'User Acceptance Test (UAT)', start: at(44), duration: 5, parent: 'test', resources: ['res1'] },

    { key: 'deploy', name: 'Deployment & Go-Live', start: at(50), duration: 3, priority: 'High', color: TASK_COLORS[5], resources: ['res4'] },
    { key: 'handover', name: 'Pelatihan Pengguna & Serah Terima', start: at(53), duration: 4, color: TASK_COLORS[9], resources: ['res3'] },
  ];

  const idOf = (key: string): string => `task_${key}`;
  const tasks: Task[] = specs.map((spec) => ({
    id: idOf(spec.key),
    name: spec.name,
    description: '',
    startDate: spec.start,
    duration: spec.duration,
    progress: spec.progress ?? 0,
    priority: spec.priority ?? 'Medium',
    color: spec.color ?? TASK_COLORS[1],
    parentId: null,
    resourceIds: [...(spec.resources ?? [])],
  }));

  const index = new Map(tasks.map((item) => [item.id, item]));
  for (const spec of specs) {
    if (!spec.parent) continue;
    const child = index.get(idOf(spec.key));
    const parent = index.get(idOf(spec.parent));
    if (child && parent) child.parentId = parent.id;
  }
  return tasks;
}

function seedDependencies(): Dependency[] {
  const dep = (
    predecessorKey: string,
    successorKey: string,
    type: Dependency['type'],
    lag: number,
  ): Dependency => ({
    id: `dep_${predecessorKey}_${successorKey}_${type}`,
    predecessorId: `task_${predecessorKey}`,
    successorId: `task_${successorKey}`,
    type,
    lag,
  });

  return [
    dep('charter', 'kickoff', 'FS', 0),
    dep('kickoff', 'wawancara', 'FS', 0),
    dep('wawancara', 'srs', 'SS', 1),
    dep('srs', 'ux', 'FS', 1),
    dep('ux', 'ui', 'SS', 2),
    dep('ui', 'infra', 'FS', 0),
    dep('infra', 'backend', 'FS', 0),
    dep('backend', 'frontend', 'SS', 4),
    dep('frontend', 'utest', 'FS', 1),
    dep('utest', 'uat', 'FS', 0),
    dep('uat', 'deploy', 'FS', 1),
    dep('deploy', 'handover', 'FS', 0),
  ];
}

function seedResources(): Resource[] {
  return [
    { id: 'res1', name: 'Anisa Rahmawati', email: 'anisa.rahmawati@example.com', role: 'UI/UX Designer', salary: 11_500_000 },
    { id: 'res2', name: 'Bagus Prakoso', email: 'bagus.prakoso@example.com', role: 'Product Manager', salary: 15_000_000 },
    { id: 'res3', name: 'Citra Lestari', email: 'citra.lestari@example.com', role: 'Frontend Engineer', salary: 13_000_000 },
    { id: 'res4', name: 'Dimas Firmansyah', email: 'dimas.firmansyah@example.com', role: 'Backend Engineer', salary: 14_000_000 },
  ];
}

export function createSeedProject(projectStart?: string): ProjectData {
  const start = projectStart ?? defaultProjectStart();
  return {
    version: PROJECT_VERSION,
    projectName: 'Peluncuran Platform E-Commerce',
    tasks: seedTasks(start),
    dependencies: seedDependencies(),
    resources: seedResources(),
    calendar: {
      weekendDays: [...SEED_WEEKEND_DAYS],
      holidays: seedHolidays(start),
    },
  };
}
