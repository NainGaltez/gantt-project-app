import { useState } from 'react';
import { ProjectProvider, useProject } from './state/ProjectContext';
import { formatCurrency, formatShort } from './lib/date';
import { totalProjectCost } from './lib/schedule';
import GanttPanel from './components/GanttPanel';
import TaskPanel from './components/TaskPanel';
import ResourcePanel from './components/ResourcePanel';
import CalendarPanel from './components/CalendarPanel';
import AnalysisPanel from './components/AnalysisPanel';

type TabKey = 'gantt' | 'tasks' | 'resources' | 'calendar' | 'analysis';

interface TabDefinition {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: TabDefinition[] = [
  { key: 'gantt', label: 'Gantt Chart', icon: '📊' },
  { key: 'tasks', label: 'Tugas', icon: '✅' },
  { key: 'resources', label: 'Sumber Daya', icon: '👥' },
  { key: 'calendar', label: 'Kalender', icon: '📅' },
  { key: 'analysis', label: 'Analisis', icon: '🧭' },
];

function Shell() {
  const { data, schedule, dispatch } = useProject();
  const [tab, setTab] = useState<TabKey>('gantt');

  const criticalCount = Object.values(schedule.byId).filter(
    (item) => item.isCritical && !item.isSummary,
  ).length;
  const cost = totalProjectCost(data, schedule);

  const resetToSeed = () => {
    if (window.confirm('Muat ulang data contoh (seed)? Perubahan Anda saat ini akan diganti.')) {
      dispatch({ type: 'reset' });
      setTab('gantt');
    }
  };

  const clearAll = () => {
    if (window.confirm('Kosongkan seluruh tugas, dependensi, dan resource proyek?')) {
      dispatch({ type: 'clearAll' });
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="header__top">
          <div className="brand">
            <div className="brand__logo">G</div>
            <div>
              <div className="brand__name">Gantt Project Manager</div>
              <div className="brand__sub">Manajemen proyek · hari kerja · jalur kritis · PERT</div>
            </div>
          </div>

          <div className="project-name">
            <input
              value={data.projectName}
              onChange={(event) => dispatch({ type: 'setProjectName', name: event.target.value })}
              placeholder="Nama proyek"
              aria-label="Nama proyek"
            />
          </div>

          <div className="header__actions">
            <button type="button" className="btn" onClick={resetToSeed}>
              ↺ Muat Data Contoh
            </button>
            <button type="button" className="btn btn--danger" onClick={clearAll}>
              Kosongkan Proyek
            </button>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat__label">Mulai</div>
            <div className="stat__value">{schedule.projectStart ? formatShort(schedule.projectStart) : '—'}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Selesai</div>
            <div className="stat__value">{schedule.projectFinish ? formatShort(schedule.projectFinish) : '—'}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Durasi</div>
            <div className="stat__value">{schedule.projectDuration} hari kerja</div>
          </div>
          <div className={`stat ${criticalCount > 0 ? 'stat--critical' : ''}`}>
            <div className="stat__label">Jalur kritis</div>
            <div className="stat__value">{criticalCount} tugas</div>
          </div>
          <div className="stat">
            <div className="stat__label">Tim</div>
            <div className="stat__value">{data.resources.length} orang</div>
          </div>
          <div className="stat">
            <div className="stat__label">Biaya resource</div>
            <div className="stat__value">{formatCurrency(cost)}</div>
          </div>
        </div>

        <nav className="tabs" aria-label="Navigasi utama">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`tab ${tab === item.key ? 'tab--active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
              {item.key === 'tasks' && <span className="tab__count">{data.tasks.length}</span>}
              {item.key === 'resources' && <span className="tab__count">{data.resources.length}</span>}
              {item.key === 'calendar' && (
                <span className="tab__count">{data.calendar.holidays.length}</span>
              )}
              {item.key === 'gantt' && <span className="tab__count">{data.dependencies.length}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {tab === 'gantt' && <GanttPanel />}
        {tab === 'tasks' && <TaskPanel />}
        {tab === 'resources' && <ResourcePanel />}
        {tab === 'calendar' && <CalendarPanel />}
        {tab === 'analysis' && <AnalysisPanel />}

        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-soft)',
            fontSize: 12,
            marginTop: 22,
          }}
        >
          Data tersimpan otomatis di localStorage browser · React + TypeScript + Vite
        </p>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}
