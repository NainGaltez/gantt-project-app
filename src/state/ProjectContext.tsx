import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Dependency, Holiday, ProjectData, Resource, Task } from '../types';
import { createSeedProject } from '../data/seed';
import { clearProject, loadProject, saveProject } from '../lib/storage';
import { computeSchedule, buildTaskTree, computeResourceUsage, descendantIds } from '../lib/schedule';
import type { ScheduleResult, TaskNode, ResourceUsage } from '../lib/schedule';
import { PROJECT_VERSION } from '../types';
import { todayISO } from '../lib/date';

export type ProjectAction =
  | { type: 'setProjectName'; name: string }
  | { type: 'addTask'; task: Task }
  | { type: 'updateTask'; task: Task }
  | { type: 'removeTask'; id: string }
  | { type: 'addDependency'; dependency: Dependency }
  | { type: 'updateDependency'; dependency: Dependency }
  | { type: 'removeDependency'; id: string }
  | { type: 'addResource'; resource: Resource }
  | { type: 'updateResource'; resource: Resource }
  | { type: 'removeResource'; id: string }
  | { type: 'setWeekendDays'; days: number[] }
  | { type: 'addHoliday'; holiday: Holiday }
  | { type: 'removeHoliday'; id: string }
  | { type: 'reset' }
  | { type: 'clearAll' };

function emptyProject(): ProjectData {
  return {
    version: PROJECT_VERSION,
    projectName: 'Proyek Baru',
    tasks: [],
    dependencies: [],
    resources: [],
    calendar: { weekendDays: [0, 6], holidays: [] },
  };
}

/** Reducer murni (diuji lewat unit test). */
export function projectReducer(state: ProjectData, action: ProjectAction): ProjectData {
  switch (action.type) {
    case 'setProjectName':
      return { ...state, projectName: action.name };

    case 'addTask':
      return state.tasks.some((task) => task.id === action.task.id)
        ? state
        : { ...state, tasks: [...state.tasks, action.task] };

    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.task.id ? action.task : task)),
      };

    case 'removeTask': {
      if (!state.tasks.some((task) => task.id === action.id)) return state;
      const childrenMap = new Map<string, string[]>();
      for (const task of state.tasks) {
        const parentId = task.parentId ?? '__root__';
        childrenMap.set(parentId, [...(childrenMap.get(parentId) ?? []), task.id]);
      }
      const toRemove = new Set<string>();
      const stack = [action.id];
      while (stack.length > 0) {
        const current = stack.pop() as string;
        if (toRemove.has(current)) continue;
        toRemove.add(current);
        stack.push(...(childrenMap.get(current) ?? []));
      }
      return {
        ...state,
        tasks: state.tasks
          .filter((task) => !toRemove.has(task.id))
          .map((task) =>
            task.parentId && toRemove.has(task.parentId)
              ? { ...task, parentId: null }
              : task,
          ),
        dependencies: state.dependencies.filter(
          (dependency) =>
            !toRemove.has(dependency.predecessorId) && !toRemove.has(dependency.successorId),
        ),
      };
    }

    case 'addDependency':
      return state.dependencies.some((dependency) => dependency.id === action.dependency.id)
        ? state
        : { ...state, dependencies: [...state.dependencies, action.dependency] };

    case 'updateDependency':
      return {
        ...state,
        dependencies: state.dependencies.map((dependency) =>
          dependency.id === action.dependency.id ? action.dependency : dependency,
        ),
      };

    case 'removeDependency':
      return {
        ...state,
        dependencies: state.dependencies.filter((dependency) => dependency.id !== action.id),
      };

    case 'addResource':
      return state.resources.some((resource) => resource.id === action.resource.id)
        ? state
        : { ...state, resources: [...state.resources, action.resource] };

    case 'updateResource':
      return {
        ...state,
        resources: state.resources.map((resource) =>
          resource.id === action.resource.id ? action.resource : resource,
        ),
      };

    case 'removeResource':
      return {
        ...state,
        resources: state.resources.filter((resource) => resource.id !== action.id),
        tasks: state.tasks.map((task) => ({
          ...task,
          resourceIds: task.resourceIds.filter((id) => id !== action.id),
        })),
      };

    case 'setWeekendDays':
      return {
        ...state,
        calendar: {
          ...state.calendar,
          weekendDays: [...new Set(action.days.filter((day) => day >= 0 && day <= 6))].sort(
            (a, b) => a - b,
          ),
        },
      };

    case 'addHoliday':
      return state.calendar.holidays.some((holiday) => holiday.id === action.holiday.id)
        ? state
        : {
            ...state,
            calendar: {
              ...state.calendar,
              holidays: [...state.calendar.holidays, action.holiday].sort((a, b) =>
                a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
              ),
            },
          };

    case 'removeHoliday':
      return {
        ...state,
        calendar: {
          ...state.calendar,
          holidays: state.calendar.holidays.filter((holiday) => holiday.id !== action.id),
        },
      };

    case 'reset':
      return createSeedProject();

    case 'clearAll':
      return emptyProject();

    default:
      return state;
  }
}

export interface ProjectContextValue {
  data: ProjectData;
  dispatch: Dispatch<ProjectAction>;
  schedule: ScheduleResult;
  tree: TaskNode[];
  resourceUsage: Record<string, ResourceUsage>;
  isDirty: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(projectReducer, undefined, () => loadProject(todayISO()));

  useEffect(() => {
    saveProject(data);
  }, [data]);

  const value = useMemo<ProjectContextValue>(() => {
    const schedule = computeSchedule(data);
    return {
      data,
      dispatch,
      schedule,
      tree: buildTaskTree(data.tasks),
      resourceUsage: computeResourceUsage(data, schedule),
      isDirty: false,
    };
  }, [data]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject harus dipakai di dalam <ProjectProvider>');
  return context;
}

export function resetStorage(): void {
  clearProject();
}

export { descendantIds };
