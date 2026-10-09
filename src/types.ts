/**
 * Tipe data inti aplikasi Manajemen Proyek Gantt Chart.
 */

/** Tanggal dalam format ISO `yyyy-mm-dd`. */
export type ISODate = string;

export type TaskPriority = 'Low' | 'Medium' | 'High';

/** FS = Finish-to-Start, SS = Start-to-Start. */
export type DependencyType = 'FS' | 'SS';

export interface Task {
  id: string;
  name: string;
  description: string;
  /** Tanggal mulai paling awal yang diizinkan (constraint manual) — hanya dipakai tugas daun. */
  startDate: ISODate;
  /** Durasi dalam HARI KERJA — hanya dipakai tugas daun. */
  duration: number;
  /** Progres 0-100 — hanya dipakai tugas daun. */
  progress: number;
  priority: TaskPriority;
  /** Warna indikator bar pada Gantt Chart. */
  color: string;
  /** ID tugas induk, `null` bila tugas level teratas (parent-child). */
  parentId: string | null;
  /** ID anggota tim yang dialokasikan ke tugas ini. */
  resourceIds: string[];
}

export interface Dependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  /** Jeda (lag/delay) dalam hari kerja. */
  lag: number;
}

export interface Resource {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Gaji per bulan (Rupiah). */
  salary: number;
}

export interface Holiday {
  id: string;
  date: ISODate;
  name: string;
}

export interface CalendarConfig {
  /** 0 = Minggu, 1 = Senin, ... 6 = Sabtu. */
  weekendDays: number[];
  holidays: Holiday[];
}

export interface ProjectData {
  version: number;
  projectName: string;
  tasks: Task[];
  dependencies: Dependency[];
  resources: Resource[];
  calendar: CalendarConfig;
}

/** Relasi alokasi anggota tim ke sebuah tugas (resourceIds disimpan di dalam Task). */
export interface TaskResourceLink {
  taskId: string;
  resourceId: string;
}

export const PRIORITY_ORDER: TaskPriority[] = ['Low', 'Medium', 'High'];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  Low: 'Rendah',
  Medium: 'Sedang',
  High: 'Tinggi',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  Low: '#16a34a',
  Medium: '#f59e0b',
  High: '#dc2626',
};

export const DEPENDENCY_LABELS: Record<DependencyType, string> = {
  FS: 'Finish-to-Start',
  SS: 'Start-to-Start',
};

export const DEPENDENCY_SHORT: Record<DependencyType, string> = {
  FS: 'FS',
  SS: 'SS',
};

/** Palet warna indikator tugas. */
export const TASK_COLORS: string[] = [
  '#2563eb',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#84cc16',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#6366f1',
  '#64748b',
];

export const PROJECT_VERSION = 1;

/** Asumsi hari kerja efektif per bulan untuk konversi gaji bulanan → tarif harian. */
export const WORKING_DAYS_PER_MONTH = 21;
