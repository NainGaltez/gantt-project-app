import type { Dependency, ISODate, ProjectData, Task } from '../types';
import { WORKING_DAYS_PER_MONTH } from '../types';
import {
  addDays,
  countWorkingDays,
  diffInDays,
  maxDate,
  minDate,
  nextWorkingDay,
  parseISODate,
  shiftWorkingDays,
  shiftWorkingDaysBack,
  toISODate,
} from './date';

/**
 * Mesin penjadwalan proyek.
 *
 * - Tugas daun (tanpa sub-tugas) dijadwalkan dengan forward pass & backward pass
 *   dengan memperhatikan dependensi Finish-to-Start (FS) dan Start-to-Start (SS)
 *   beserta lag (jeda hari kerja).
 * - Tugas induk bersifat *summary*: jadwalnya di-roll-up dari sub-tugas.
 * - Tugas dengan total float 0 berada pada jalur kritis (critical path).
 */

export interface TaskSchedule {
  taskId: string;
  earlyStart: ISODate;
  earlyFinish: ISODate;
  lateStart: ISODate;
  lateFinish: ISODate;
  /** Durasi hari kerja. */
  duration: number;
  /** Total float (kelonggaran) dalam hari kerja. */
  totalFloat: number;
  isCritical: boolean;
  isSummary: boolean;
}

export interface ScheduleResult {
  byId: Record<string, TaskSchedule>;
  /** Urutan topologi tugas daun. */
  order: string[];
  /** ID tugas (daun) yang membentuk jalur kritis, terurut dari awal ke akhir. */
  criticalPath: string[];
  projectStart: ISODate | null;
  projectFinish: ISODate | null;
  /** Total durasi proyek dalam hari kerja. */
  projectDuration: number;
  hasCycle: boolean;
}

export interface TaskNode {
  task: Task;
  depth: number;
  isSummary: boolean;
}

const EMPTY_SCHEDULE: ScheduleResult = {
  byId: {},
  order: [],
  criticalPath: [],
  projectStart: null,
  projectFinish: null,
  projectDuration: 0,
  hasCycle: false,
};

/** Peta induk → daftar anak (parent-child). */
export function buildHierarchy(tasks: Task[]): Map<string, Task[]> {
  const childrenMap = new Map<string, Task[]>();
  const known = new Set(tasks.map((task) => task.id));
  for (const task of tasks) childrenMap.set(task.id, []);
  for (const task of tasks) {
    const parentId =
      task.parentId && task.parentId !== task.id && known.has(task.parentId) ? task.parentId : null;
    if (parentId) childrenMap.get(parentId)?.push(task);
  }
  return childrenMap;
}

export function childTasks(childrenMap: Map<string, Task[]>, taskId: string): Task[] {
  return childrenMap.get(taskId) ?? [];
}

export function isSummary(childrenMap: Map<string, Task[]>, taskId: string): boolean {
  return childTasks(childrenMap, taskId).length > 0;
}

export function leafTasks(tasks: Task[]): Task[] {
  const childrenMap = buildHierarchy(tasks);
  return tasks.filter((task) => !isSummary(childrenMap, task.id));
}

/** Daftar tugas terurut untuk tampilan (induk diikuti anak-anaknya, kedalaman disertakan). */
export function buildTaskTree(tasks: Task[]): TaskNode[] {
  const childrenMap = buildHierarchy(tasks);
  const known = new Set(tasks.map((task) => task.id));
  const nodes: TaskNode[] = [];
  const visited = new Set<string>();

  const visit = (task: Task, depth: number) => {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    const children = childTasks(childrenMap, task.id);
    nodes.push({ task, depth, isSummary: children.length > 0 });
    for (const child of children) visit(child, depth + 1);
  };

  for (const task of tasks) {
    const parentId =
      task.parentId && task.parentId !== task.id && known.has(task.parentId) ? task.parentId : null;
    if (!parentId) visit(task, 0);
  }
  // Sisa tugas yang tidak terjangkau (mis. akibat relasi siklik) tetap ditampilkan.
  for (const task of tasks) visit(task, 0);
  return nodes;
}

/** Semua ID keturunan (termasuk anak, cucu, dst.). */
export function descendantIds(tasks: Task[], taskId: string): Set<string> {
  const childrenMap = buildHierarchy(tasks);
  const result = new Set<string>();
  const stack = [...childTasks(childrenMap, taskId)];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || result.has(current.id)) continue;
    result.add(current.id);
    stack.push(...childTasks(childrenMap, current.id));
  }
  return result;
}

/** Kedalaman tiap tugas (untuk roll-up bottom-up). */
function computeDepths(tasks: Task[], childrenMap: Map<string, Task[]>): Map<string, number> {
  const depth = new Map<string, number>();
  const compute = (task: Task, guard: number): number => {
    if (guard > tasks.length + 1) return 0;
    const existing = depth.get(task.id);
    if (existing !== undefined) return existing;
    const own = Math.max(...childTasks(childrenMap, task.id).map((child) => compute(child, guard + 1)));
    const value = childTasks(childrenMap, task.id).length > 0 ? own + 1 : 0;
    depth.set(task.id, value);
    return value;
  };
  for (const task of tasks) {
    if (!depth.has(task.id)) compute(task, 0);
  }
  return depth;
}

function topoSort(ids: string[], dependencies: Dependency[]): { order: string[]; hasCycle: boolean } {
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const adjacency = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const dependency of dependencies) {
    if (!indegree.has(dependency.predecessorId) || !indegree.has(dependency.successorId)) continue;
    adjacency.get(dependency.predecessorId)?.push(dependency.successorId);
    indegree.set(dependency.successorId, (indegree.get(dependency.successorId) ?? 0) + 1);
  }

  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  let head = 0;
  while (head < queue.length) {
    const id = queue[head];
    head += 1;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  const hasCycle = order.length !== ids.length;
  if (hasCycle) {
    // Tugas yang terlibat siklus tetap dijadwalkan (tanpa mematuhi siklusnya).
    const seen = new Set(order);
    for (const id of ids) if (!seen.has(id)) order.push(id);
  }
  return { order, hasCycle };
}

/** Benar bila menambahkan dependensi `candidate` akan membentuk siklus. */
export function wouldCreateCycle(
  dependencies: Dependency[],
  candidate: Pick<Dependency, 'predecessorId' | 'successorId'>,
): boolean {
  const { predecessorId, successorId } = candidate;
  if (predecessorId === successorId) return true;

  const adjacency = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const list = adjacency.get(dependency.predecessorId) ?? [];
    list.push(dependency.successorId);
    adjacency.set(dependency.predecessorId, list);
  }

  // Siklus terjadi bila successor sudah bisa mencapai predecessor.
  const stack = [successorId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === predecessorId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

/** Level PERT: 0 untuk tugas tanpa predecessor, selanjutnya 1 + level predecessor tertinggi. */
export function computePertLevels(ids: string[], dependencies: Dependency[]): Map<string, number> {
  const { order } = topoSort(ids, dependencies);
  const levels = new Map<string, number>();
  const incoming = new Map<string, Dependency[]>();
  for (const dependency of dependencies) {
    const list = incoming.get(dependency.successorId) ?? [];
    list.push(dependency);
    incoming.set(dependency.successorId, list);
  }
  for (const id of order) {
    let level = 0;
    for (const dependency of incoming.get(id) ?? []) {
      level = Math.max(level, (levels.get(dependency.predecessorId) ?? 0) + 1);
    }
    levels.set(id, level);
  }
  return levels;
}

function criticalPathChain(
  leaves: Task[],
  dependencies: Dependency[],
  byId: Record<string, TaskSchedule>,
  calendar: ProjectData['calendar'],
): string[] {
  const incoming = new Map<string, Dependency[]>();
  for (const dependency of dependencies) {
    const list = incoming.get(dependency.successorId) ?? [];
    list.push(dependency);
    incoming.set(dependency.successorId, list);
  }

  let currentId: string | undefined;
  let currentSchedule: TaskSchedule | undefined;
  for (const leaf of leaves) {
    const schedule = byId[leaf.id];
    if (!schedule) continue;
    if (!currentSchedule || diffInDays(parseISODate(currentSchedule.earlyFinish), parseISODate(schedule.earlyFinish)) > 0) {
      currentId = leaf.id;
      currentSchedule = schedule;
    }
  }
  if (!currentId) return [];

  const chain: string[] = [];
  const guard = new Set<string>();
  while (currentId && !guard.has(currentId)) {
    guard.add(currentId);
    chain.push(currentId);
    const currentSchedule2 = byId[currentId];
    if (!currentSchedule2) break;

    let nextPredId: string | undefined;
    for (const dependency of incoming.get(currentId) ?? []) {
      const pred = byId[dependency.predecessorId];
      if (!pred || !pred.isCritical || pred.totalFloat !== 0) continue;
      const predFinish = parseISODate(pred.earlyFinish);
      const predStart = parseISODate(pred.earlyStart);
      const tight =
        dependency.type === 'FS'
          ? toISODate(shiftWorkingDays(predFinish, Math.round(dependency.lag) + 1, calendar)) ===
            currentSchedule2.earlyStart
          : toISODate(shiftWorkingDays(predStart, Math.round(dependency.lag), calendar)) ===
            currentSchedule2.earlyStart;
      if (tight) {
        nextPredId = dependency.predecessorId;
        break;
      }
    }
    if (!nextPredId) break;
    currentId = nextPredId;
  }

  return chain.reverse();
}

export function computeSchedule(data: ProjectData): ScheduleResult {
  const tasks = data.tasks;
  if (tasks.length === 0) return { ...EMPTY_SCHEDULE };

  const calendar = data.calendar;
  const childrenMap = buildHierarchy(tasks);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const leaves = tasks.filter((task) => !isSummary(childrenMap, task.id));
  const leafIds = leaves.map((leaf) => leaf.id);
  const leafSet = new Set(leafIds);

  const dependencies = data.dependencies.filter(
    (dependency) =>
      dependency.predecessorId !== dependency.successorId &&
      leafSet.has(dependency.predecessorId) &&
      leafSet.has(dependency.successorId),
  );

  const { order, hasCycle } = topoSort(leafIds, dependencies);

  const incoming = new Map<string, Dependency[]>();
  const outgoing = new Map<string, Dependency[]>();
  for (const dependency of dependencies) {
    incoming.set(dependency.successorId, [
      ...(incoming.get(dependency.successorId) ?? []),
      dependency,
    ]);
    outgoing.set(dependency.predecessorId, [
      ...(outgoing.get(dependency.predecessorId) ?? []),
      dependency,
    ]);
  }

  const startMap = new Map<string, Date>();
  const finishMap = new Map<string, Date>();
  const durationMap = new Map<string, number>();

  // ---------- Forward pass ----------
  for (const id of order) {
    const task = taskById.get(id);
    if (!task) continue;
    const duration = Math.max(1, Math.round(task.duration) || 1);
    durationMap.set(id, duration);

    let start = nextWorkingDay(parseISODate(task.startDate), calendar);
    for (const dependency of incoming.get(id) ?? []) {
      const predStart = startMap.get(dependency.predecessorId);
      const predFinish = finishMap.get(dependency.predecessorId);
      if (!predStart || !predFinish) continue;
      const lag = Math.round(dependency.lag) || 0;
      const candidate =
        dependency.type === 'FS'
          ? shiftWorkingDays(predFinish, lag + 1, calendar)
          : shiftWorkingDays(predStart, lag, calendar);
      start = maxDate(start, candidate);
    }
    startMap.set(id, start);
    finishMap.set(id, shiftWorkingDays(start, duration - 1, calendar));
  }

  let projectFinish: Date | undefined;
  for (const date of finishMap.values()) {
    projectFinish = projectFinish ? maxDate(projectFinish, date) : date;
  }
  if (!projectFinish) return { ...EMPTY_SCHEDULE };

  // ---------- Backward pass ----------
  const lateStartMap = new Map<string, Date>();
  const lateFinishMap = new Map<string, Date>();

  for (const id of [...order].reverse()) {
    const task = taskById.get(id);
    if (!task) continue;
    const duration = durationMap.get(id) ?? 1;

    let latestFinish = projectFinish;
    for (const dependency of outgoing.get(id) ?? []) {
      const successorLateStart = lateStartMap.get(dependency.successorId);
      if (!successorLateStart) continue;
      const lag = Math.round(dependency.lag) || 0;
      const candidate =
        dependency.type === 'FS'
          ? shiftWorkingDaysBack(successorLateStart, lag + 1, calendar)
          : shiftWorkingDays(
              shiftWorkingDaysBack(successorLateStart, lag, calendar),
              duration - 1,
              calendar,
            );
      latestFinish = minDate(latestFinish, candidate);
    }

    const latestStart = shiftWorkingDaysBack(latestFinish, duration - 1, calendar);
    lateFinishMap.set(id, latestFinish);
    lateStartMap.set(id, latestStart);
  }

  const byId: Record<string, TaskSchedule> = {};
  for (const id of order) {
    const start = startMap.get(id);
    const finish = finishMap.get(id);
    const lateStart = lateStartMap.get(id);
    const lateFinish = lateFinishMap.get(id);
    if (!start || !finish || !lateStart || !lateFinish) continue;
    const totalFloat = Math.max(0, countWorkingDays(start, lateStart, calendar) - 1);
    byId[id] = {
      taskId: id,
      earlyStart: toISODate(start),
      earlyFinish: toISODate(finish),
      lateStart: toISODate(lateStart),
      lateFinish: toISODate(lateFinish),
      duration: durationMap.get(id) ?? 1,
      totalFloat,
      isCritical: totalFloat === 0,
      isSummary: false,
    };
  }

  // ---------- Roll-up tugas induk (bottom-up) ----------
  const depths = computeDepths(tasks, childrenMap);
  const summaryIds = tasks
    .filter((task) => isSummary(childrenMap, task.id))
    .sort((a, b) => (depths.get(b.id) ?? 0) - (depths.get(a.id) ?? 0));

  for (const task of summaryIds) {
    const children = childTasks(childrenMap, task.id)
      .map((child) => byId[child.id])
      .filter((schedule): schedule is TaskSchedule => Boolean(schedule));
    if (children.length === 0) continue;

    let earlyStart = parseISODate(children[0].earlyStart);
    let earlyFinish = parseISODate(children[0].earlyFinish);
    let totalFloat = children[0].totalFloat;
    for (const child of children) {
      earlyStart = minDate(earlyStart, parseISODate(child.earlyStart));
      earlyFinish = maxDate(earlyFinish, parseISODate(child.earlyFinish));
      totalFloat = Math.min(totalFloat, child.totalFloat);
    }

    byId[task.id] = {
      taskId: task.id,
      earlyStart: toISODate(earlyStart),
      earlyFinish: toISODate(earlyFinish),
      lateStart: toISODate(earlyStart),
      lateFinish: toISODate(earlyFinish),
      duration: Math.max(1, countWorkingDays(earlyStart, earlyFinish, calendar)),
      totalFloat,
      isCritical: totalFloat === 0,
      isSummary: true,
    };
  }

  let projectStartDate: Date | undefined;
  for (const schedule of Object.values(byId)) {
    const date = parseISODate(schedule.earlyStart);
    projectStartDate = projectStartDate ? minDate(projectStartDate, date) : date;
  }

  const projectStart = projectStartDate ? toISODate(projectStartDate) : null;
  const projectFinishIso = toISODate(projectFinish);

  return {
    byId,
    order,
    criticalPath: criticalPathChain(leaves, dependencies, byId, calendar),
    projectStart,
    projectFinish: projectFinishIso,
    projectDuration: projectStartDate
      ? countWorkingDays(projectStartDate, projectFinish, calendar)
      : 0,
    hasCycle,
  };
}

export interface ResourceAllocation {
  resourceId: string;
  taskId: string;
  taskName: string;
  taskColor: string;
  workingDays: number;
  cost: number;
}

export interface ResourceUsage {
  resourceId: string;
  allocations: ResourceAllocation[];
  totalWorkingDays: number;
  totalCost: number;
}

/** Tarif harian diturunkan dari gaji bulanan dengan asumsi 21 hari kerja efektif per bulan. */
export function dailyRate(salary: number): number {
  const safe = Number.isFinite(salary) ? salary : 0;
  return safe / WORKING_DAYS_PER_MONTH;
}

export function computeResourceUsage(
  data: ProjectData,
  schedule: ScheduleResult,
): Record<string, ResourceUsage> {
  const usage: Record<string, ResourceUsage> = {};
  for (const resource of data.resources) {
    usage[resource.id] = {
      resourceId: resource.id,
      allocations: [],
      totalWorkingDays: 0,
      totalCost: 0,
    };
  }

  for (const task of data.tasks) {
    if (task.resourceIds.length === 0) continue;
    const taskSchedule = schedule.byId[task.id];
    if (!taskSchedule) continue;
    for (const resourceId of task.resourceIds) {
      const entry = usage[resourceId];
      if (!entry) continue;
      const resource = data.resources.find((item) => item.id === resourceId);
      const cost = dailyRate(resource?.salary ?? 0) * taskSchedule.duration;
      entry.allocations.push({
        resourceId,
        taskId: task.id,
        taskName: task.name,
        taskColor: task.color,
        workingDays: taskSchedule.duration,
        cost,
      });
      entry.totalWorkingDays += taskSchedule.duration;
      entry.totalCost += cost;
    }
  }

  return usage;
}

export function totalProjectCost(data: ProjectData, schedule: ScheduleResult): number {
  const usage = computeResourceUsage(data, schedule);
  return Object.values(usage).reduce((total, entry) => total + entry.totalCost, 0);
}

/** Rentang tanggal yang perlu ditampilkan pada Gantt Chart (dengan padding hari). */
export function timelineRange(
  schedule: ScheduleResult,
  paddingBefore = 3,
  paddingAfter = 7,
): { start: ISODate; end: ISODate } | null {
  if (!schedule.projectStart || !schedule.projectFinish) return null;
  const start = addDays(parseISODate(schedule.projectStart), -paddingBefore);
  const end = addDays(parseISODate(schedule.projectFinish), paddingAfter);
  return { start: toISODate(start), end: toISODate(end) };
}
