import { useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { WEEKDAY_NAMES, countWorkingDays, formatLong, formatShort, isWorkingDay, parseISODate, toISODate } from '../lib/date';
import { uid } from '../lib/id';
import type { ISODate } from '../types';

export default function CalendarPanel() {
  const { data, dispatch } = useProject();
  const [date, setDate] = useState<ISODate>('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const calendar = data.calendar;
  const weekendDays = new Set(calendar.weekendDays);
  const today = toISODate(new Date());
  const inThisMonth = (offset: number): ISODate => {
    const value = new Date();
    value.setDate(value.getDate() + offset);
    return toISODate(value);
  };

  const toggleWeekend = (day: number) => {
    const next = weekendDays.has(day)
      ? calendar.weekendDays.filter((item) => item !== day)
      : [...calendar.weekendDays, day];
    dispatch({ type: 'setWeekendDays', days: next });
  };

  const addHoliday = () => {
    setError('');
    if (!date) {
      setError('Pilih tanggal libur terlebih dahulu.');
      return;
    }
    if (!name.trim()) {
      setError('Nama hari libur wajib diisi.');
      return;
    }
    if (calendar.holidays.some((holiday) => holiday.date === date)) {
      setError('Tanggal tersebut sudah terdaftar sebagai hari libur.');
      return;
    }
    dispatch({
      type: 'addHoliday',
      holiday: { id: uid('holiday'), date, name: name.trim() },
    });
    setDate('');
    setName('');
  };

  const rangeStart = inThisMonth(-30);
  const rangeEnd = inThisMonth(60);
  const workingDaysInRange = countWorkingDays(
    parseISODate(rangeStart),
    parseISODate(rangeEnd),
    calendar,
  );
  const calendarDays = countWorkingDays(
    parseISODate(rangeStart),
    parseISODate(rangeEnd),
    { ...calendar, weekendDays: [], holidays: [] },
  );

  return (
    <>
      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Kalender Proyek</div>
            <div className="panel__subtitle">
              Seluruh perhitungan durasi hanya menghitung hari kerja (bukan akhir pekan &amp; bukan hari
              libur khusus)
            </div>
          </div>
          <div className="panel__actions">
            <span className="badge badge--info">
              {workingDaysInRange} hari kerja dari {calendarDays} hari ({rangeStart} → {rangeEnd})
            </span>
          </div>
        </div>

        <div className="panel__body">
          <h3 className="panel__title" style={{ fontSize: 14, marginBottom: 10 }}>
            1. Pengaturan Akhir Pekan (weekend)
          </h3>
          <div className="weekday-grid">
            {WEEKDAY_NAMES.map((label, day) => (
              <label
                key={label}
                className={`weekday-card ${weekendDays.has(day) ? 'weekday-card--active' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={weekendDays.has(day)}
                  onChange={() => toggleWeekend(day)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div
            className="notice"
            style={{ marginTop: 14 }}
            title="Cara kerja hari kerja"
          >
            <span>🗓️</span>
            <span>
              Hari kerja aktif saat ini:{' '}
              <strong>
                {WEEKDAY_NAMES.filter((_, day) => !weekendDays.has(day)).join(', ') || 'tidak ada'}
              </strong>
              . Tanggal {formatLong(today)} saat ini dianggap{' '}
              <strong>{isWorkingDay(new Date(), calendar) ? 'hari kerja' : 'hari libur'}</strong>.
            </span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Hari Libur Khusus (custom holiday)</div>
            <div className="panel__subtitle">
              {calendar.holidays.length} hari libur terdaftar — contoh: libur nasional, cuti bersama
            </div>
          </div>
        </div>

        <div className="panel__body">
          {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="holiday-form">
            <div className="field">
              <label className="field__label" htmlFor="holiday-date">Tanggal</label>
              <input
                id="holiday-date"
                type="date"
                className="input"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="holiday-name">Nama hari libur</label>
              <input
                id="holiday-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Contoh: Hari Kemerdekaan RI"
              />
            </div>
            <button type="button" className="btn btn--primary" onClick={addHoliday}>
              + Tambah Libur
            </button>
          </div>

          <div className="holiday-list">
            {calendar.holidays.length === 0 && (
              <div className="empty" style={{ padding: 20 }}>
                Belum ada hari libur khusus.
              </div>
            )}
            {[...calendar.holidays]
              .sort((a, b) => (a.date < b.date ? -1 : 1))
              .map((holiday) => (
                <div className="holiday-item" key={holiday.id}>
                  <span className="holiday-item__date">{formatShort(holiday.date)}</span>
                  <span className="holiday-item__name">{holiday.name}</span>
                  <span className="badge badge--neutral">
                    {WEEKDAY_NAMES[parseISODate(holiday.date).getDay()]}
                  </span>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => dispatch({ type: 'removeHoliday', id: holiday.id })}
                  >
                    Hapus
                  </button>
                </div>
              ))}
          </div>

          <div className="notice" style={{ marginTop: 16 }}>
            <span>ℹ️</span>
            <span>
              Mengubah pengaturan akhir pekan atau hari libur akan <strong>langsung menghitung ulang</strong>{' '}
              seluruh jadwal Gantt, jalur kritis, dan diagram PERT.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
