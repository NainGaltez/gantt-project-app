import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';
import { ProjectProvider } from './state/ProjectContext';
import TaskPanel from './components/TaskPanel';
import ResourcePanel from './components/ResourcePanel';
import CalendarPanel from './components/CalendarPanel';
import AnalysisPanel from './components/AnalysisPanel';

/**
 * Smoke test: mem-render komponen lewat React seperti yang dilakukan browser,
 * untuk memastikan seluruh panel dapat dirender tanpa error.
 */
describe('render UI aplikasi', () => {
  it('header, tab, dan statistik proyek tampil pada layar Gantt', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Gantt Project Manager');
    expect(html).toContain('Peluncuran Platform E-Commerce');
    expect(html).toContain('Gantt Chart');
    expect(html).toContain('Sumber Daya');
    expect(html).toContain('Kalender');
    expect(html).toContain('Analisis');
    expect(html).toContain('Jalur kritis');
    expect(html).toContain('hari kerja');
    // Bar tugas seed ikut dirender
    expect(html).toContain('Pengembangan Backend API');
    expect(html).toContain('Tambah Dependensi');
  });

  it('panel tugas menampilkan daftar tugas & sub-tugas', () => {
    const html = renderToString(
      <ProjectProvider>
        <TaskPanel />
      </ProjectProvider>,
    );

    expect(html).toContain('Manajemen Tugas');
    expect(html).toContain('Inisiasi Proyek');
    expect(html).toContain('Penyusunan Project Charter');
    expect(html).toContain('sub-tugas');
    expect(html).toContain('Tambah Tugas');
  });

  it('panel sumber daya menampilkan anggota tim dan alokasinya', () => {
    const html = renderToString(
      <ProjectProvider>
        <ResourcePanel />
      </ProjectProvider>,
    );

    expect(html).toContain('Anggota Tim');
    expect(html).toContain('Anisa Rahmawati');
    expect(html).toContain('anisa.rahmawati@example.com');
    expect(html).toContain('Gaji / bulan');
    expect(html).toContain('Frontend Engineer');
  });

  it('panel kalender menampilkan akhir pekan dan hari libur', () => {
    const html = renderToString(
      <ProjectProvider>
        <CalendarPanel />
      </ProjectProvider>,
    );

    expect(html).toContain('Kalender Proyek');
    expect(html).toContain('Sabtu');
    expect(html).toContain('Minggu');
    expect(html).toContain('Hari Libur Nasional');
    expect(html).toContain('Cuti Bersama');
  });

  it('panel analisis menampilkan jalur kritis, tabel jadwal, dan PERT', () => {
    const html = renderToString(
      <ProjectProvider>
        <AnalysisPanel />
      </ProjectProvider>,
    );

    expect(html).toContain('Jalur Kritis (Critical Path)');
    expect(html).toContain('Diagram PERT');
    expect(html).toContain('Early Start');
    expect(html).toContain('Late Finish');
    expect(html).toContain('total float');
    expect(html).toContain('Biaya resource');
  });
});
