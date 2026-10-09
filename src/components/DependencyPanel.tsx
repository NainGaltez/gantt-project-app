import { useMemo, useState } from 'react';
import type { Dependency, DependencyType } from '../types';
import { DEPENDENCY_LABELS } from '../types';
import { useProject } from '../state/ProjectContext';
import { wouldCreateCycle } from '../lib/schedule';
import { uid } from '../lib/id';

export default function DependencyPanel() {
  const { data, dispatch } = useProject();
  const [predecessorId, setPredecessorId] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [type, setType] = useState<DependencyType>('FS');
  const [lag, setLag] = useState(0);
  const [error, setError] = useState('');

  const leaves = useMemo(() => {
    const parents = new Set(data.tasks.map((task) => task.parentId).filter(Boolean));
    return data.tasks.filter((task) => !parents.has(task.id));
  }, [data.tasks]);

  const nameOf = (id: string): string => data.tasks.find((task) => task.id === id)?.name ?? '—';

  const addDependency = () => {
    setError('');
    if (!predecessorId || !successorId) {
      setError('Pilih tugas pendahulu dan tugas penerima.');
      return;
    }
    if (predecessorId === successorId) {
      setError('Sebuah tugas tidak boleh menjadi predecessor dirinya sendiri.');
      return;
    }
    const exists = data.dependencies.some(
      (dependency) =>
        dependency.predecessorId === predecessorId &&
        dependency.successorId === successorId &&
        dependency.type === type,
    );
    if (exists) {
      setError('Dependensi tersebut sudah terdaftar.');
      return;
    }
    if (wouldCreateCycle(data.dependencies, { predecessorId, successorId })) {
      setError('Dependensi ini akan membuat siklus (circular dependency).');
      return;
    }

    dispatch({
      type: 'addDependency',
      dependency: {
        id: uid('dep'),
        predecessorId,
        successorId,
        type,
        lag: Math.max(0, Math.round(lag) || 0),
      },
    });
    setSuccessorId('');
    setLag(0);
  };

  const updateLag = (dependency: Dependency, value: number) => {
    dispatch({
      type: 'updateDependency',
      dependency: { ...dependency, lag: Math.max(0, Math.round(value) || 0) },
    });
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <div className="panel__title">Predecessors &amp; Dependensi</div>
          <div className="panel__subtitle">
            Hubungan Finish-to-Start (FS) dan Start-to-Start (SS) beserta jeda hari kerja (lag)
          </div>
        </div>
      </div>

      <div className="panel__body">
        {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="dep-form">
          <div className="field">
            <label className="field__label" htmlFor="dep-pred">Tugas pendahulu (predecessor)</label>
            <select
              id="dep-pred"
              className="select"
              value={predecessorId}
              onChange={(event) => setPredecessorId(event.target.value)}
            >
              <option value="">— Pilih tugas —</option>
              {leaves.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="field__label">Tipe relasi</span>
            <div className="dep-type-toggle">
              <button
                type="button"
                className={type === 'FS' ? 'active' : ''}
                onClick={() => setType('FS')}
                title={DEPENDENCY_LABELS.FS}
              >
                FS
              </button>
              <button
                type="button"
                className={type === 'SS' ? 'active' : ''}
                onClick={() => setType('SS')}
                title={DEPENDENCY_LABELS.SS}
              >
                SS
              </button>
            </div>
            <span className="field__hint">
              {type === 'FS' ? 'Mulai setelah pendahulu selesai' : 'Mulai bersamaan dengan pendahulu'}
            </span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="dep-succ">Tugas penerima (successor)</label>
            <select
              id="dep-succ"
              className="select"
              value={successorId}
              onChange={(event) => setSuccessorId(event.target.value)}
            >
              <option value="">— Pilih tugas —</option>
              {leaves.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ maxWidth: 130 }}>
            <label className="field__label" htmlFor="dep-lag">Jeda (lag, hari kerja)</label>
            <input
              id="dep-lag"
              type="number"
              min={0}
              className="input"
              value={lag}
              onChange={(event) => setLag(Number(event.target.value))}
            />
          </div>

          <button type="button" className="btn btn--primary" onClick={addDependency}>
            + Tambah Dependensi
          </button>
        </div>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          {data.dependencies.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>
              Belum ada dependensi. Tugas akan dijadwalkan sesuai tanggal mulai masing-masing.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Predecessor</th>
                  <th>Relasi</th>
                  <th>Successor</th>
                  <th className="num">Lag (hari kerja)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.dependencies.map((dependency) => (
                  <tr key={dependency.id}>
                    <td className="dep-row-title">{nameOf(dependency.predecessorId)}</td>
                    <td>
                      <span className="badge badge--info" title={DEPENDENCY_LABELS[dependency.type]}>
                        {dependency.type}
                      </span>
                      <span className="dep-row-sub" style={{ marginLeft: 6 }}>
                        {DEPENDENCY_LABELS[dependency.type]}
                      </span>
                    </td>
                    <td className="dep-row-title">{nameOf(dependency.successorId)}</td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        className="input"
                        style={{ width: 90, textAlign: 'right' }}
                        value={dependency.lag}
                        onChange={(event) => updateLag(dependency, Number(event.target.value))}
                      />
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button
                          type="button"
                          className="btn btn--sm btn--icon btn--danger"
                          onClick={() => dispatch({ type: 'removeDependency', id: dependency.id })}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
