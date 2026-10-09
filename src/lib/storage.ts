import type { Dependency, Holiday, ProjectData, Resource, Task, TaskPriority, CalendarConfig, DependencyType } from '../types';
import { PROJECT_VERSION, TASK_COLORS } from '../types';
import { createSeedProject } from '../data/seed';

/** Kunci penyimpanan di localStorage (versioned agar aman saat skema berubah). */
export const STORAGE_KEY = 'gantt-project-manager:data:v1';

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];
const DEPENDENCY_TYPES: DependencyType[] = ['FS', 'SS'];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeDate(value: unknown, fallback: string): string {
  const candidate = asString(value);
  if (ISO_PATTERN.test(candidate)) return candidate;
  return fallback;
}

function sanitizeTask(input: unknown, index: number, fallbackDate: string): Task | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const id = asString(raw.id) || `task_imported_${index}`;
  const name = asString(raw.name).trim();
  if (!name) return null;

  const priorityRaw = asString(raw.priority, 'Medium') as TaskPriority;
  const priority = PRIORITIES.includes(priorityRaw) ? priorityRaw : 'Medium';
  const color = asString(raw.color, TASK_COLORS[index % TASK_COLORS.length]);
  const resourceIds = Array.isArray(raw.resourceIds)
    ? raw.resourceIds.filter((item): item is string => typeof item === 'string')
    : [];
  const parentIdRaw = typeof raw.parentId === 'string' && raw.parentId.length > 0 ? raw.parentId : null;

  return {
    id,
    name,
    description: asString(raw.description),
    startDate: sanitizeDate(raw.startDate, fallbackDate),
    duration: Math.max(1, Math.round(asFiniteNumber(raw.duration, 1))),
    progress: Math.round(clamp(asFiniteNumber(raw.progress, 0), 0, 100)),
    priority,
    color,
    parentId: parentIdRaw === id ? null : parentIdRaw,
    resourceIds: [...new Set(resourceIds)],
  };
}

function sanitizeDependency(input: unknown, index: number): Dependency | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const predecessorId = asString(raw.predecessorId);
  const successorId = asString(raw.successorId);
  if (!predecessorId || !successorId || predecessorId === successorId) return null;

  const typeRaw = asString(raw.type, 'FS') as DependencyType;
  return {
    id: asString(raw.id) || `dep_imported_${index}`,
    predecessorId,
    successorId,
    type: DEPENDENCY_TYPES.includes(typeRaw) ? typeRaw : 'FS',
    lag: Math.max(0, Math.round(asFiniteNumber(raw.lag, 0))),
  };
}

function sanitizeResource(input: unknown, index: number): Resource | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const name = asString(raw.name).trim();
  if (!name) return null;
  return {
    id: asString(raw.id) || `res_imported_${index}`,
    name,
    email: asString(raw.email),
    role: asString(raw.role),
    salary: Math.max(0, asFiniteNumber(raw.salary, 0)),
  };
}

function sanitizeHoliday(input: unknown, index: number): Holiday | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const date = sanitizeDate(raw.date, '');
  const name = asString(raw.name).trim();
  if (!date || !name) return null;
  return { id: asString(raw.id) || `holiday_imported_${index}`, date, name };
}

function sanitizeCalendar(input: unknown): CalendarConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const weekendDays = Array.isArray(raw.weekendDays)
    ? [...new Set(
        raw.weekendDays
          .map((day) => Math.round(Number(day)))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
      )].sort((a, b) => a - b)
    : [0, 6];
  const holidays = Array.isArray(raw.holidays)
    ? (raw.holidays.map(sanitizeHoliday).filter((item): item is Holiday => item !== null))
    : [];
  return { weekendDays, holidays };
}

/**
 * Menormalkan data apa pun dari storage menjadi struktur {@link ProjectData}.
 * Mengembalikan `null` bila input sama sekali tidak layak dipakai.
 */
export function normalizeProject(input: unknown, fallbackDate: string): ProjectData | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;

  const tasks = Array.isArray(raw.tasks)
    ? (raw.tasks
        .map((item, index) => sanitizeTask(item, index, fallbackDate))
        .filter((item): item is Task => item !== null))
    : [];
  const knownIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    if (task.parentId && !knownIds.has(task.parentId)) task.parentId = null;
  }

  const dependencies = Array.isArray(raw.dependencies)
    ? (raw.dependencies
        .map((item, index) => sanitizeDependency(item, index))
        .filter((item): item is Dependency => item !== null)
        .filter((dependency) => knownIds.has(dependency.predecessorId) && knownIds.has(dependency.successorId)))
    : [];
  const resourceIds = new Set(
    Array.isArray(raw.resources)
      ? raw.resources
          .map((item, index) => sanitizeResource(item, index))
          .filter((item): item is Resource => item !== null)
          .map((resource) => resource.id)
      : [],
  );
  for (const task of tasks) {
    task.resourceIds = task.resourceIds.filter((id) => resourceIds.has(id));
  }

  const resources = Array.isArray(raw.resources)
    ? (raw.resources
        .map((item, index) => sanitizeResource(item, index))
        .filter((item): item is Resource => item !== null))
    : [];

  return {
    version: PROJECT_VERSION,
    projectName: asString(raw.projectName).trim() || 'Proyek Tanpa Nama',
    tasks,
    dependencies,
    resources,
    calendar: sanitizeCalendar(raw.calendar),
  };
}

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Muat data proyek dari localStorage; kembali ke seed data bila kosong/rusak. */
export function loadProject(fallbackDate: string): ProjectData {
  if (!hasWindow()) return createSeedProject(fallbackDate);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedProject(fallbackDate);
    const parsed: unknown = JSON.parse(raw);
    return normalizeProject(parsed, fallbackDate) ?? createSeedProject(fallbackDate);
  } catch {
    return createSeedProject(fallbackDate);
  }
}

export function saveProject(data: ProjectData): boolean {
  if (!hasWindow()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearProject(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* abaikan */
  }
}
