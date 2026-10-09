import { useState } from 'react';
import type { Task } from '../types';
import { useProject } from '../state/ProjectContext';
import GanttChart from './GanttChart';
import DependencyPanel from './DependencyPanel';
import TaskForm from './TaskForm';

export default function GanttPanel() {
  const { data, dispatch } = useProject();
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Gantt Chart — {data.projectName}</div>
            <div className="panel__subtitle">
              Bar tugas, panah dependensi, drag &amp; resize, penanda jalur kritis
            </div>
          </div>
          <div className="panel__actions">
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
              + Tambah Tugas
            </button>
          </div>
        </div>

        <GanttChart onEditTask={(task) => setEditing(task)} />
      </div>

      <DependencyPanel />

      {(creating || editing) && (
        <TaskForm
          task={editing}
          tasks={data.tasks}
          resources={data.resources}
          calendar={data.calendar}
          onSubmit={(task) => {
            if (editing) dispatch({ type: 'updateTask', task });
            else dispatch({ type: 'addTask', task });
            setEditing(null);
            setCreating(false);
          }}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
