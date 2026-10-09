import { useMemo, useState } from 'react';
import type { CalendarConfig, Resource, Task, TaskPriority } from '../types';
import { PRIORITY_LABELS, TASK_COLORS } from '../types';
import { finishDate, formatShort, isValidEmail } from '../lib/date';
import { descendantIds } from '../lib/schedule';
import { uid } from '../lib/id';

export interface TaskFormInitial {
  task: Task | null;
  defaultParentId: string | null;
}

interface TaskFormProps {
  task: Task | null;
  defaultParentId?: string | null;
  tasks: Task[];
  resources: Resource[];
  calendar: CalendarConfig;
  onSubmit: (task: Task) => void;
  onClose: () => void;
}

const PRIORITY_OPTIONS: TaskPriority[] = ['Low', 'Medium', 'High'];

export default function TaskForm({
  task,
  defaultParentId,
  tasks,
  resources,
  calendar,
  onSubmit,
  onClose,
}: TaskFormProps) {
  const isSummaryTask = useMemo(
    () => (task ? tasks.some((item) => item.parentId === task.id) : false),
    [task, tasks],
  );

  const blockedParents = useMemo(() => {
    if (!task) return new Set<string>();
    const ids = descendantIds(tasks, task.id);
    ids.add(task.id);
    return ids;
  }, [tasks, task]);

  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [parentId, setParentId] = useState<string>(
    task?.parentId ?? defaultParentId ?? '',
  );
  const [startDate, setStartDate] = useState(task?.startDate ?? '');
  const [duration, setDuration] = useState<number>(task?.duration ?? 3);
  const [progress, setProgress] = useState<number>(task?.progress ?? 0);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'Medium');
  const [color, setColor] = useState(task?.color ?? TASK_COLORS[0]);
  const [resourceIds, setResourceIds] = useState<string[]>(task?.resourceIds ?? []);
  const [error, setError] = useState('');

  const parentOptions = tasks.filter((item) => !blockedParents.has(item.id));
  const finishPreview =
    startDate && duration >= 1 ? finishDate(startDate, duration, calendar) : '';
  const summary = isSummaryTask;

  const toggleResource = (id: string) => {
    setResourceIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Nama tugas wajib diisi.');
      return;
    }
    if (!summary) {
      if (!startDate) {
        setError('Tanggal mulai wajib diisi.');
        return;
      }
      if (!Number.isFinite(duration) || duration < 1) {
        setError('Durasi minimal 1 hari kerja.');
        return;
      }
    }

    const next: Task = {
      id: task?.id ?? uid('task'),
      name: trimmed,
      description: description.trim(),
      startDate: summary ? (task?.startDate ?? startDate) : startDate,
      duration: Math.max(1, Math.round(duration)),
      progress: summary ? (task?.progress ?? 0) : Math.round(Math.min(100, Math.max(0, progress))),
      priority,
      color,
      parentId: parentId || null,
      resourceIds: [...resourceIds],
    };
    onSubmit(next);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__title">{task ? 'Edit Tugas' : 'Tambah Tugas'}</div>
            <div className="panel__subtitle">
              Durasi dihitung dalam hari kerja sesuai kalender proyek.
            </div>
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className="modal__body">
          {summary && (
            <div className="notice" style={{ marginBottom: 14 }}>
              <span>ℹ️</span>
              <span>
                Tugas ini memiliki sub-tugas, sehingga tanggal mulai, selesai, durasi, dan progresnya
                <strong> dihitung otomatis (roll-up)</strong> dari sub-tugas di bawahnya.
              </span>
            </div>
          )}

          {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

          <div className="form-grid form-grid--full">
            <div className="field field--wide">
              <label className="field__label" htmlFor="task-name">
                Nama tugas <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="task-name"
                className="input"
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                placeholder="Contoh: Penyusunan Dokumen SRS"
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="task-parent">Tugas induk (parent-child)</label>
              <select
                id="task-parent"
                className="select"
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">— Tugas level atas —</option>
                {parentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <span className="field__hint">
                Pilih induk untuk menjadikan tugas ini sebagai sub-tugas.
              </span>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="task-start">Tanggal mulai</label>
              <input
                id="task-start"
                type="date"
                className="input"
                value={startDate}
                disabled={summary}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="task-duration">Durasi (hari kerja)</label>
              <input
                id="task-duration"
                type="number"
                min={1}
                className="input"
                value={duration}
                disabled={summary}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
              {finishPreview && (
                <span className="field__hint">Selesai: {formatShort(finishPreview)}</span>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="task-progress">
                Progres {summary ? '(otomatis)' : `${progress}%`}
              </label>
              <input
                id="task-progress"
                type="range"
                min={0}
                max={100}
                step={5}
                className="input"
                style={{ padding: '4px 0' }}
                value={progress}
                disabled={summary}
                onChange={(event) => setProgress(Number(event.target.value))}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="task-priority">Prioritas</label>
              <select
                id="task-priority"
                className="select"
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {PRIORITY_LABELS[option]} ({option})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label">Warna indikator</label>
              <div className="color-picker">
                {TASK_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={`color-swatch ${color === swatch ? 'color-swatch--active' : ''}`}
                    style={{ background: swatch }}
                    onClick={() => setColor(swatch)}
                    aria-label={`Warna ${swatch}`}
                  />
                ))}
                <input
                  type="color"
                  className="color-native"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  aria-label="Pilih warna kustom"
                />
              </div>
            </div>

            <div className="field field--wide">
              <label className="field__label" htmlFor="task-desc">Deskripsi</label>
              <textarea
                id="task-desc"
                className="textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Catatan singkat mengenai tugas ini…"
              />
            </div>

            <div className="field field--wide">
              <label className="field__label">Alokasi anggota tim (resource)</label>
              {resources.length === 0 ? (
                <span className="field__hint">
                  Belum ada anggota tim. Tambahkan lewat tab <strong>Sumber Daya</strong>.
                </span>
              ) : (
                <div className="resource-picker">
                  {resources.map((resource) => (
                    <label key={resource.id} className="resource-option">
                      <input
                        type="checkbox"
                        checked={resourceIds.includes(resource.id)}
                        onChange={() => toggleResource(resource.id)}
                      />
                      <span className="avatar">{initials(resource.name)}</span>
                      <span>
                        {resource.name}{' '}
                        <span style={{ color: 'var(--text-muted)' }}>· {resource.role || 'Tanpa peran'}</span>
                      </span>
                      {resource.email && !isValidEmail(resource.email) && (
                        <span className="badge badge--high">email tidak valid</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {task ? 'Simpan Perubahan' : 'Tambahkan Tugas'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
