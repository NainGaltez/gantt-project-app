import { useMemo, useState } from 'react';
import type { Task } from '../types';
import { PRIORITY_LABELS } from '../types';
import { useProject } from '../state/ProjectContext';
import { formatShort } from '../lib/date';
import { toggleSet, visibleTreeNodes } from '../lib/view';
import TaskForm, { initials } from './TaskForm';

export default function TaskPanel() {
  const { data, schedule, tree, resourceUsage, dispatch } = useProject();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ task: Task | null; parentId: string | null } | null>(null);

  const nodes = useMemo(() => visibleTreeNodes(tree, collapsed), [tree, collapsed]);

  const handleSubmit = (task: Task) => {
    if (modal?.task) dispatch({ type: 'updateTask', task });
    else dispatch({ type: 'addTask', task });
    setModal(null);
  };

  const removeTask = (task: Task) => {
    const hasChild = data.tasks.some((item) => item.parentId === task.id);
    const message = hasChild
      ? `Hapus tugas "${task.name}" beserta seluruh sub-tugasnya?`
      : `Hapus tugas "${task.name}"?`;
    if (window.confirm(message)) dispatch({ type: 'removeTask', id: task.id });
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <div className="panel__title">Manajemen Tugas</div>
          <div className="panel__subtitle">
            {data.tasks.length} tugas · {data.tasks.filter((task) =>
              data.tasks.some((item) => item.parentId === task.id),
            ).length}{' '}
            tugas induk · durasi dalam hari kerja
          </div>
        </div>
        <div className="panel__actions">
          <button type="button" className="btn btn--primary" onClick={() => setModal({ task: null, parentId: null })}>
            + Tambah Tugas
          </button>
        </div>
      </div>

      <div className="panel__body panel__body--flush">
        {nodes.length === 0 ? (
          <div className="empty">
            <div className="empty__title">Belum ada tugas</div>
            <p>Mulai dengan menambahkan tugas pertama proyek Anda.</p>
            <p style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setModal({ task: null, parentId: null })}
              >
                + Tambah Tugas
              </button>
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tugas</th>
                  <th>Jadwal</th>
                  <th className="num">Durasi</th>
                  <th>Prioritas</th>
                  <th>Progres</th>
                  <th>Alokasi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => {
                  const task = node.task;
                  const nodeSchedule = schedule.byId[task.id];
                  const children = data.tasks.filter((item) => item.parentId === task.id);
                  return (
                    <tr key={task.id}>
                      <td>
                        <div className="cell-name" style={{ paddingLeft: node.depth * 16 }}>
                          <button
                            type="button"
                            className={`chevron ${node.isSummary ? '' : 'chevron--hidden'}`}
                            onClick={() => setCollapsed((current) => toggleSet(current, task.id))}
                            aria-label="Buka/tutup sub-tugas"
                          >
                            {collapsed.has(task.id) ? '▶' : '▼'}
                          </button>
                          <span className="cell-name__dot" style={{ background: task.color }} />
                          <div>
                            <div className="cell-name__text">{task.name}</div>
                            <div className="cell-name__sub">
                              {node.isSummary
                                ? `${children.length} sub-tugas${nodeSchedule ? ` · ${nodeSchedule.duration} hari kerja` : ''}`
                                : task.description || (nodeSchedule?.isCritical ? 'Jalur kritis' : 'Tugas biasa')}
                            </div>
                          </div>
                          {nodeSchedule?.isCritical && <span className="badge badge--critical">Kritis</span>}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {nodeSchedule ? (
                          <>
                            {formatShort(nodeSchedule.earlyStart)} → {formatShort(nodeSchedule.earlyFinish)}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {nodeSchedule ? `${nodeSchedule.duration} hari` : '-'}
                      </td>
                      <td>
                        <span className={`badge badge--${task.priority.toLowerCase()}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </td>
                      <td style={{ minWidth: 120 }}>
                        {node.isSummary ? (
                          <span className="cell-name__sub">roll-up</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 7,
                                background: 'var(--surface-3)',
                                borderRadius: 999,
                                overflow: 'hidden',
                                minWidth: 60,
                              }}
                            >
                              <div
                                style={{
                                  width: `${task.progress}%`,
                                  height: '100%',
                                  background: task.progress >= 100 ? 'var(--success)' : 'var(--primary)',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.progress}%</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="avatar-stack">
                          {task.resourceIds.length === 0 && (
                            <span className="cell-name__sub">—</span>
                          )}
                          {task.resourceIds.map((resourceId) => {
                            const resource = data.resources.find((item) => item.id === resourceId);
                            if (!resource) return null;
                            return (
                              <span
                                key={resourceId}
                                className="avatar"
                                title={`${resource.name} (${resource.role})`}
                              >
                                {initials(resource.name)}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button
                            type="button"
                            className="btn btn--sm btn--icon"
                            title="Tambah sub-tugas"
                            onClick={() => setModal({ task: null, parentId: task.id })}
                          >
                            + Sub
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--icon"
                            onClick={() => setModal({ task, parentId: null })}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--icon btn--danger"
                            onClick={() => removeTask(task)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {Object.keys(resourceUsage).length > 0 && (
        <div className="gantt__hint">
          Total biaya resource teralokasi dihitung dari gaji bulanan ÷ 21 hari kerja × alokasi hari kerja
          tiap tugas.
        </div>
      )}

      {modal && (
        <TaskForm
          task={modal.task}
          defaultParentId={modal.parentId}
          tasks={data.tasks}
          resources={data.resources}
          calendar={data.calendar}
          onSubmit={handleSubmit}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
