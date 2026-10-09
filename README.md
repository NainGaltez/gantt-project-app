# Gantt Project Manager 📅

Aplikasi **Manajemen Proyek berbasis Gantt Chart** yang dibangun dengan **React + TypeScript + Vite**.

Semua data disimpan di `localStorage` browser dan tersedia dalam bentuk **data contoh (seed data)** begitu aplikasi dibuka pertama kali.

---

## ✨ Fitur

| # | Fitur | Detail |
|---|-------|--------|
| 1 | **Task Management** | Tambah / edit / hapus tugas, durasi dalam **hari kerja**, tanggal mulai, prioritas (Low / Medium / High), indikator warna bar, dan **sub-tugas (parent-child)** dengan roll-up jadwal otomatis pada tugas induk. |
| 2 | **Predecessors & Timeline** | Hubungan antar tugas **Finish-to-Start (FS)** dan **Start-to-Start (SS)** beserta **jeda hari (lag/delay)**, tampilan Gantt Chart dengan bar tugas, panah dependensi, **drag untuk menggeser** dan **resize untuk mengubah durasi**. |
| 3 | **Resource Management** | Pendaftaran anggota tim (nama, email, peran, gaji), alokasi anggota ke tugas, perhitungan alokasi (hari kerja & biaya) per anggota. |
| 4 | **Kalender Proyek** | Pengaturan hari akhir pekan (weekend) dan **hari libur khusus (custom holiday)**. Seluruh durasi & penjadwalan hanya menghitung **hari kerja**. |
| 5 | **Analisis Proyek** | Penandaan **jalur kritis (Critical Path)** di Gantt Chart, tabel analisis (Early/Late/Float), daftar jalur kritis, dan **diagram PERT**. |

Tambahan:

- Data tersimpan otomatis di `localStorage` (key: `gantt-project-manager:data:v1`).
- Tampilan responsif (desktop, tablet, mobile) dan mudah dipakai.
- Tersedia tombol **Reset ke Data Contoh** dan **Kosongkan Proyek**.

---

## 🛠️ Tech Stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) (dev server & production build)
- [Vitest](https://vitest.dev/) untuk unit test (logika kalender & penjadwalan) sekaligus integration test UI berbasis **jsdom**

> Tidak ada library Gantt/penjadwalan tambahan — diagram Gantt, panah dependensi, dan diagram PERT diimplementasikan sendiri (DOM + SVG), sehingga perilaku hari kerja 100% sesuai kalender proyek.

---

## 📦 Cara Install

Pastikan **Node.js ≥ 20.19** (atau ≥ 22.12 / 24, sesuai kebutuhan Vite 8) dan **npm** sudah terpasang, lalu:

```bash
npm install
```

## ▶️ Cara Menjalankan

```bash
# jalankan dev server (http://localhost:5173)
npm run dev
```

Buka `http://localhost:5173` di browser.

### Perintah lainnya

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Jalankan development server |
| `npm run typecheck` | Cek tipe TypeScript (`tsc --noEmit`) |
| `npm test` | Jalankan unit test (Vitest) |
| `npm run build` | Typecheck + build produksi ke `dist/` |
| `npm run preview` | Pratinjau hasil build produksi |

---

## 📂 Struktur Proyek

```
.
├── .gitignore                  # Mengabaikan node_modules, dist, .env, log, cache
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts              # Konfigurasi Vite + Vitest
└── src/
    ├── main.tsx                 # Entry point React
    ├── App.tsx                  # Layout aplikasi & navigasi tab
    ├── App.smoke.test.tsx       # Smoke test render tiap panel
    ├── App.dom.test.tsx         # Integration test DOM (jsdom)
    ├── styles.css               # Gaya seluruh aplikasi
    ├── types.ts                 # Tipe domain (Task, Dependency, Resource, dll.)
    ├── data/seed.ts             # Data contoh (seed data)
    ├── lib/
    │   ├── date.ts              # Mesin kalender hari kerja (weekend + holiday)
    │   ├── date.test.ts         # Unit test kalender hari kerja
    │   ├── schedule.ts          # Forward/backward pass, critical path, PERT, roll-up
    │   ├── schedule.test.ts     # Unit test penjadwalan & jalur kritis
    │   ├── storage.ts           # Load/save/normalisasi localStorage
    │   ├── storage.test.ts      # Unit test normalisasi penyimpanan
    │   ├── view.ts              # Helper tampilan pohon tugas
    │   └── id.ts                # Generator ID unik
    ├── state/ProjectContext.tsx # Reducer + Context global (state aplikasi)
    └── components/
        ├── GanttChart.tsx       # Grafik Gantt (bar, panah, drag/resize, zoom)
        ├── GanttPanel.tsx       # Tab Gantt + form tugas
        ├── TaskPanel.tsx        # Manajemen tugas & sub-tugas
        ├── TaskForm.tsx         # Form tambah/edit tugas
        ├── DependencyPanel.tsx  # Manajemen predecessor (FS/SS + lag)
        ├── ResourcePanel.tsx    # Manajemen anggota tim & alokasi
        ├── CalendarPanel.tsx    # Weekend & hari libur khusus
        ├── AnalysisPanel.tsx    # Jalur kritis + tabel analisis
        └── PertChart.tsx        # Diagram PERT
```

---

## 🧮 Aturan Perhitungan

- **Hari kerja** = hari yang bukan akhir pekan (sesuai pengaturan kalender) **dan** bukan hari libur khusus.
- **Durasi tugas** dihitung dalam hari kerja; tanggal selesai = hari kerja ke-N sejak tanggal mulai.
- **Dependency FS dengan lag L**: tugas penerima mulai **L + 1 hari kerja** setelah tugas pendahulu selesai.
- **Dependency SS dengan lag L**: tugas penerima mulai **L hari kerja** setelah tugas pendahulu mulai.
- **Tugas induk (punya sub-tugas)** bersifat *summary*: tanggal mulai/selesai & durasinya di-*roll-up* dari sub-tugas.
- **Total float** = jumlah hari kerja antara *early start* dan *late start*; **float = 0 → jalur kritis**.
- **Biaya resource** = gaji bulanan ÷ 21 hari kerja efektif × alokasi hari kerja pada tugas.

## 💾 Penyimpanan Data

Data disimpan otomatis di `localStorage` pada key `gantt-project-manager:data:v1` setiap kali terjadi perubahan. Bila data rusak/tidak kompatibel, aplikasi otomatis memuat ulang **seed data**.

## 🧪 Test

```bash
npm test
```

Unit test mencakup mesin kalender hari kerja (weekend/holiday/lag), mesin penjadwalan (forward–backward pass, jalur kritis, siklus dependensi, roll-up tugas induk), dan normalisasi penyimpanan. Ditambah integration test yang me-render aplikasi sungguhan (tab Gantt, Tugas, Sumber Daya, Kalender, Analisis), memverifikasi bar & panah dependensi, perubahan pengaturan akhir pekan, serta penyimpanan ke localStorage.

## 📄 Lisensi

MIT — bebas dipakai dan dimodifikasi.
