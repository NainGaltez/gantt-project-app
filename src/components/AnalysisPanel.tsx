import { useProject } from '../state/ProjectContext';
import { totalProjectCost } from '../lib/schedule';
import { formatCurrency, formatShort } from '../lib/date';
import PertChart from './PertChart';

export default function AnalysisPanel() {
  const { data, schedule, tree } = useProject();

  const criticalTasks = schedule.criticalPath
    .map((id) => data.tasks.find((task) => task.id === id))
    .filter((task): task is NonNullable<typeof task> => Boolean(task));

  const criticalCount = Object.values(schedule.byId).filter(
    (item) => item.isCritical && !item.isSummary,
  ).length;

  const totalCost = totalProjectCost(data, schedule);

  return (
    <>
      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Analisis Proyek</div>
            <div className="panel__subtitle">
              Perhitungan forward pass, backward pass, total float, dan jalur kritis
            </div>
          </div>
        </div>

        <div className="panel__body">
          {schedule.hasCycle && (
            <div className="form-error" style={{ marginBottom: 14 }}>
              ⚠️ Ditemukan dependensi bersiklus (circular). Jadwal tetap ditampilkan, tetapi hasilnya
              mungkin tidak optimal. Periksa daftar dependensi pada tab Gantt Chart.
            </div>
          )}

          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-card__label">Mulai proyek</div>
              <div className="summary-card__value" style={{ fontSize: 16 }}>
                {schedule.projectStart ? formatShort(schedule.projectStart) : '-'}
              </div>
              <div className="summary-card__hint">Early start terawal</div>
            </div>
            <div className="summary-card">
              <div className="summary-card__label">Selesai proyek</div>
              <div className="summary-card__value" style={{ fontSize: 16 }}>
                {schedule.projectFinish ? formatShort(schedule.projectFinish) : '-'}
              </div>
              <div className="summary-card__hint">Early finish terakhir</div>
            </div>
            <div className="summary-card">
              <div className="summary-card__label">Durasi total</div>
              <div className="summary-card__value">{schedule.projectDuration}</div>
              <div className="summary-card__hint">hari kerja</div>
            </div>
            <div className="summary-card">
              <div className="summary-card__label">Jumlah tugas</div>
              <div className="summary-card__value">{data.tasks.length}</div>
              <div className="summary-card__hint">
                {data.dependencies.length} dependensi
              </div>
            </div>
            <div className={`summary-card ${criticalCount > 0 ? 'summary-card--critical' : ''}`}>
              <div className="summary-card__label">Tugas jalur kritis</div>
              <div className="summary-card__value">{criticalCount}</div>
              <div className="summary-card__hint">total float = 0 hari</div>
            </div>
            <div className="summary-card">
              <div className="summary-card__label">Biaya resource</div>
              <div className="summary-card__value" style={{ fontSize: 17 }}>
                {formatCurrency(totalCost)}
              </div>
              <div className="summary-card__hint">gaji × alokasi hari kerja</div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <h3 className="panel__title" style={{ fontSize: 14, marginBottom: 8 }}>
              Jalur Kritis (Critical Path)
            </h3>
            {criticalTasks.length === 0 ? (
              <div className="empty" style={{ padding: 18 }}>
                Belum ada jalur kritis — tambahkan tugas terlebih dahulu.
              </div>
            ) : (
              <div className="critical-path">
                {criticalTasks.map((task, index) => (
                  <span key={task.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {index > 0 && <span className="critical-path__arrow">→</span>}
                    <span className="critical-path__node">
                      {task.name} · {schedule.byId[task.id]?.duration}h
                    </span>
                  </span>
                ))}
              </div>
            )}
            <p className="field__hint" style={{ marginTop: 8 }}>
              Jalur kritis adalah urutan tugas yang menentukan durasi tercepat proyek; keterlambatan satu
              tugas pada jalur ini menunda seluruh proyek.
            </p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Analisis Jadwal per Tugas</div>
            <div className="panel__subtitle">
              Early start/finish, late start/finish, dan total float (hari kerja)
            </div>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tugas</th>
                  <th>Level</th>
                  <th>Early Start</th>
                  <th>Early Finish</th>
                  <th>Late Start</th>
                  <th>Late Finish</th>
                  <th className="num">Float</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tree.map((node) => {
                  const item = schedule.byId[node.task.id];
                  if (!item) return null;
                  return (
                    <tr key={node.task.id}>
                      <td>
                        <div className="cell-name" style={{ paddingLeft: node.depth * 16, minWidth: 200 }}>
                          <span className="cell-name__dot" style={{ background: node.task.color }} />
                          <span className="cell-name__text">{node.task.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge--neutral">
                          {item.isSummary ? 'Induk (roll-up)' : `Level ${node.depth}`}
                        </span>
                      </td>
                      <td>{formatShort(item.earlyStart)}</td>
                      <td>{formatShort(item.earlyFinish)}</td>
                      <td>{formatShort(item.lateStart)}</td>
                      <td>{formatShort(item.lateFinish)}</td>
                      <td className="num">
                        <strong style={{ color: item.totalFloat === 0 ? 'var(--critical)' : undefined }}>
                          {item.totalFloat}
                        </strong>
                      </td>
                      <td>
                        {item.isCritical ? (
                          <span className="badge badge--critical">Jalur kritis</span>
                        ) : (
                          <span className="badge badge--neutral">
                            Longgar {item.totalFloat} hari
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Diagram PERT</div>
            <div className="panel__subtitle">
              Jaringan tugas daun: Early/Late time, durasi, dan total float tiap node
            </div>
          </div>
          <div className="panel__actions">
            <span className="chip">
              <span className="chip__dot" style={{ background: 'var(--critical)' }} /> Node &amp; panah merah = jalur kritis
            </span>
            <span className="chip">FS = Finish-to-Start · SS = Start-to-Start · angka = lag (hari kerja)</span>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          <PertChart />
        </div>
      </div>
    </>
  );
}
