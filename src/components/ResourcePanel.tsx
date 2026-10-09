import { useState } from 'react';
import type { Resource } from '../types';
import { useProject } from '../state/ProjectContext';
import { WORKING_DAYS_PER_MONTH } from '../types';
import { dailyRate } from '../lib/schedule';
import { formatCurrency, isValidEmail } from '../lib/date';
import { uid } from '../lib/id';
import { initials } from './TaskForm';

const EMPTY_FORM = { name: '', email: '', role: '', salary: 0 };

export default function ResourcePanel() {
  const { data, schedule, resourceUsage, dispatch } = useProject();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const startEdit = (resource: Resource) => {
    setEditingId(resource.id);
    setForm({ name: resource.name, email: resource.email, role: resource.role, salary: resource.salary });
    setError('');
  };

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const submit = () => {
    if (!form.name.trim()) {
      setError('Nama anggota tim wajib diisi.');
      return;
    }
    if (form.email.trim() && !isValidEmail(form.email)) {
      setError('Format email tidak valid.');
      return;
    }
    const salary = Math.max(0, Number(form.salary) || 0);

    if (editingId) {
      dispatch({
        type: 'updateResource',
        resource: {
          id: editingId,
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role.trim(),
          salary,
        },
      });
    } else {
      dispatch({
        type: 'addResource',
        resource: {
          id: uid('res'),
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role.trim(),
          salary,
        },
      });
    }
    reset();
  };

  const remove = (resource: Resource) => {
    const count = data.tasks.filter((task) => task.resourceIds.includes(resource.id)).length;
    const message =
      count > 0
        ? `Hapus "${resource.name}" dari daftar tim? Resource ini teralokasi di ${count} tugas.`
        : `Hapus "${resource.name}" dari daftar tim?`;
    if (window.confirm(message)) {
      dispatch({ type: 'removeResource', id: resource.id });
      if (editingId === resource.id) reset();
    }
  };

  const totalCost = Object.values(resourceUsage).reduce((sum, item) => sum + item.totalCost, 0);
  const totalDays = Object.values(resourceUsage).reduce((sum, item) => sum + item.totalWorkingDays, 0);

  return (
    <>
      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Sumber Daya / Anggota Tim</div>
            <div className="panel__subtitle">
              {data.resources.length} anggota · tarif harian = gaji bulanan ÷ {WORKING_DAYS_PER_MONTH} hari
              kerja efektif
            </div>
          </div>
        </div>

        <div className="panel__body">
          {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="res-name">
                Nama <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="res-name"
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="res-email">Email</label>
              <input
                id="res-email"
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="nama@perusahaan.com"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="res-role">Peran</label>
              <input
                id="res-role"
                className="input"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                placeholder="Frontend Engineer"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="res-salary">Gaji / bulan (Rp)</label>
              <input
                id="res-salary"
                type="number"
                min={0}
                step={100000}
                className="input"
                value={form.salary}
                onChange={(event) => setForm({ ...form, salary: Number(event.target.value) })}
                placeholder="12000000"
              />
              <span className="field__hint">
                ≈ {formatCurrency(dailyRate(Math.max(0, Number(form.salary) || 0)))} / hari kerja
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" className="btn btn--primary" onClick={submit}>
              {editingId ? 'Simpan Perubahan' : '+ Tambah Anggota'}
            </button>
            {editingId && (
              <button type="button" className="btn" onClick={reset}>
                Batal
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Daftar Anggota &amp; Alokasi</div>
            <div className="panel__subtitle">
              Total {totalDays} hari kerja teralokasi · {formatCurrency(totalCost)}
            </div>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {data.resources.length === 0 ? (
            <div className="empty">
              <div className="empty__title">Belum ada anggota tim</div>
              <p>Tambahkan anggota lewat formulir di atas untuk mengalokasikannya ke tugas.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Anggota</th>
                    <th>Peran</th>
                    <th className="num">Gaji / bulan</th>
                    <th className="num">Tarif / hari</th>
                    <th className="num">Alokasi</th>
                    <th className="num">Biaya</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.resources.map((resource) => {
                    const usage = resourceUsage[resource.id];
                    const allocations = usage?.allocations ?? [];
                    return [
                      <tr key={resource.id}>
                        <td>
                          <div className="cell-name" style={{ minWidth: 180 }}>
                            <span className="avatar">{initials(resource.name)}</span>
                            <div>
                              <div className="cell-name__text">{resource.name}</div>
                              <div className="cell-name__sub">
                                {resource.email || <span style={{ color: 'var(--warning)' }}>tanpa email</span>}
                                {!isValidEmail(resource.email) && resource.email && (
                                  <span className="badge badge--high" style={{ marginLeft: 6 }}>
                                    email tidak valid
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{resource.role || '-'}</td>
                        <td className="num">{formatCurrency(resource.salary)}</td>
                        <td className="num">{formatCurrency(dailyRate(resource.salary))}</td>
                        <td className="num">
                          <span className="badge badge--neutral">
                            {usage?.totalWorkingDays ?? 0} hari
                          </span>
                          <div className="cell-name__sub">{allocations.length} tugas</div>
                        </td>
                        <td className="num">{formatCurrency(usage?.totalCost ?? 0)}</td>
                        <td>
                          <div className="cell-actions">
                            <button
                              type="button"
                              className="btn btn--sm btn--icon"
                              onClick={() => startEdit(resource)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn--sm btn--icon btn--danger"
                              onClick={() => remove(resource)}
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>,
                      <tr key={`${resource.id}-alloc`}>
                        <td colSpan={7} style={{ background: 'var(--surface-2)', paddingTop: 8 }}>
                          {allocations.length === 0 ? (
                            <span className="cell-name__sub">
                              Belum dialokasikan ke tugas mana pun.
                            </span>
                          ) : (
                            <div className="alloc-list">
                              {allocations.map((allocation) => (
                                <div className="alloc-item" key={allocation.taskId}>
                                  <span
                                    className="chip__dot"
                                    style={{ background: allocation.taskColor }}
                                  />
                                  <span className="alloc-item__name">{allocation.taskName}</span>
                                  <span className="alloc-item__days">
                                    {schedule.byId[allocation.taskId]?.isCritical ? (
                                      <span className="badge badge--critical">Kritis</span>
                                    ) : null}
                                  </span>
                                  <span className="alloc-item__days">
                                    {allocation.workingDays} hari kerja
                                  </span>
                                  <span className="alloc-item__days">
                                    {formatCurrency(allocation.cost)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
