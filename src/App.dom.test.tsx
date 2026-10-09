// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import App from './App';
import { STORAGE_KEY } from './lib/storage';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});

function click(element: Element | null | undefined) {
  if (!element) throw new Error('Elemen tidak ditemukan untuk diklik');
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function tabWith(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button.tab')).find(
    (button) => button.textContent?.includes(label),
  );
}

describe('aplikasi berjalan di DOM', () => {
  it('merender bar Gantt, panah dependensi, dan header proyek', async () => {
    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('.brand__name')?.textContent).toBe('Gantt Project Manager');
    expect(container.querySelectorAll('.bar').length).toBeGreaterThan(5);
    expect(container.querySelectorAll('.gantt__link').length).toBeGreaterThan(3);
    expect(container.querySelectorAll('.gantt__row-left').length).toBeGreaterThan(10);
    expect(container.querySelectorAll('.gantt__band--weekend').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.gantt__day--holiday').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.bar--summary').length).toBeGreaterThan(0);
  });

  it('menyimpan data proyek ke localStorage', async () => {
    await act(async () => {
      root.render(<App />);
    });

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.projectName).toBe('Peluncuran Platform E-Commerce');
    expect(parsed.tasks.length).toBeGreaterThan(10);
    expect(Array.isArray(parsed.dependencies)).toBe(true);
    expect(parsed.calendar.weekendDays).toEqual([0, 6]);
  });

  it('beralih ke tab Analisis dan menampilkan jalur kritis serta PERT', async () => {
    await act(async () => {
      root.render(<App />);
    });

    click(tabWith('Analisis'));

    expect(container.textContent).toContain('Analisis Proyek');
    expect(container.textContent).toContain('Jalur Kritis (Critical Path)');
    expect(container.querySelector('svg[aria-label="Diagram PERT"]')).toBeTruthy();
    expect(container.querySelectorAll('.pert-node').length).toBeGreaterThan(5);
    expect(container.querySelectorAll('.pert-node--critical').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Early Start');
  });

  it('beralih ke tab Sumber Daya dan menampilkan alokasi anggota', async () => {
    await act(async () => {
      root.render(<App />);
    });

    click(tabWith('Sumber Daya'));

    expect(container.textContent).toContain('Anisa Rahmawati');
    expect(container.textContent).toContain('Gaji / bulan');
    expect(container.querySelectorAll('.alloc-item').length).toBeGreaterThan(0);
  });

  it('mengubah akhir pekan pada tab Kalender dan langsung tersimpan', async () => {
    await act(async () => {
      root.render(<App />);
    });

    click(tabWith('Kalender'));

    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('.weekday-card input'),
    );
    expect(checkboxes).toHaveLength(7);
    // Sabtu (index 6) — nonaktifkan agar Sabtu menjadi hari kerja.
    act(() => {
      checkboxes[6].click();
    });

    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
    expect(parsed.calendar.weekendDays).toEqual([0]);
    expect(checkboxes[6].checked).toBe(false);
  });

  it('membuka modal tambah tugas dari tab Tugas', async () => {
    await act(async () => {
      root.render(<App />);
    });

    click(tabWith('Tugas'));
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '+ Tambah Tugas',
    );
    click(addButton);

    expect(container.querySelector('.modal')).toBeTruthy();
    expect(container.querySelector('#task-name')).toBeTruthy();
    expect(container.textContent).toContain('Durasi (hari kerja)');
  });
});
