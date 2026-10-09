import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CalendarConfig, ISODate, Task } from '../types';
import { useProject } from '../state/ProjectContext';
import { computeSchedule, timelineRange } from '../lib/schedule';
import { toggleSet, visibleTreeNodes } from '../lib/view';
import {
  MONTH_NAMES,
  addDays,
  diffInDays,
  eachDay,
  finishDate,
  formatShort,
  isHoliday,
  isWeekend,
  nextWorkingDay,
  parseISODate,
  toISODate,
  todayISO,
  workingDuration,
} from '../lib/date';

const ROW_HEIGHT = 40;
const BAR_HEIGHT = 22;
const DAY_MIN = 18;
const DAY_MAX = 64;

interface DragState {
  taskId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  pointerX: number;
  original: Task;
}

interface DayInfo {
  date: Date;
  iso: ISODate;
  weekend: boolean;
  holiday: boolean;
  dayOfMonth: number;
  weekday: number;
}

interface MonthSegment {
  label: string;
  year: number;
  month: number;
  count: number;
  start: number;
}

function computeDraggedTask(
  original: Task,
  mode: DragState['mode'],
  delta: number,
  calendar: CalendarConfig,
): Task {
  if (delta === 0) return original;

  if (mode === 'move') {
    const nextStart = nextWorkingDay(addDays(parseISODate(original.startDate), delta), calendar);
    return { ...original, startDate: toISODate(nextStart) };
  }

  const currentFinish = parseISODate(finishDate(original.startDate, original.duration, calendar));

  if (mode === 'resize-end') {
    const target = nextWorkingDay(addDays(currentFinish, delta), calendar);
    const duration = Math.max(1, workingDuration(original.startDate, toISODate(target), calendar));
    return { ...original, duration };
  }

  const candidate = nextWorkingDay(addDays(parseISODate(original.startDate), delta), calendar);
  const start = diffInDays(candidate, currentFinish) >= 0 ? candidate : currentFinish;
  const duration = Math.max(1, workingDuration(toISODate(start), toISODate(currentFinish), calendar));
  return { ...original, startDate: toISODate(start), duration };
}

export default function GanttChart({ onEditTask }: { onEditTask?: (task: Task) => void }) {
  const { data, schedule, tree, dispatch } = useProject();
  const [dayWidth, setDayWidth] = useState(34);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showCritical, setShowCritical] = useState(true);
  const [showFloat, setShowFloat] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pendingTask, setPendingTask] = useState<Task | null>(null);
  const pendingRef = useRef<Task | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const applyPending = (next: Task | null) => {
    pendingRef.current = next;
    setPendingTask(next);
  };

  const range = useMemo(() => {
    const resolved = timelineRange(schedule, 4, 8);
    if (resolved) return resolved;
    const today = todayISO();
    return { start: toISODate(addDays(parseISODate(today), -4)), end: toISODate(addDays(parseISODate(today), 40)) };
  }, [schedule]);

  const days = useMemo(() => eachDay(range.start, range.end), [range]);

  const dayList: DayInfo[] = useMemo(
    () =>
      days.map((date) => ({
        date,
        iso: toISODate(date),
        weekend: isWeekend(date, data.calendar),
        holiday: isHoliday(date, data.calendar),
        dayOfMonth: date.getDate(),
        weekday: date.getDay(),
      })),
    [days, data.calendar],
  );

  const months: MonthSegment[] = useMemo(() => {
    const segments: MonthSegment[] = [];
    for (const day of dayList) {
      const last = segments[segments.length - 1];
      if (last && last.month === day.date.getMonth() && last.year === day.date.getFullYear()) {
        last.count += 1;
      } else {
        segments.push({
          label: MONTH_NAMES[day.date.getMonth()],
          year: day.date.getFullYear(),
          month: day.date.getMonth(),
          count: 1,
          start: segments.reduce((total, item) => total + item.count, 0),
        });
      }
    }
    return segments;
  }, [dayList]);

  /** Rentang berdekatan yang bukan hari kerja (untuk menggambar band). */
  const bands = useMemo(() => {
    const result: Array<{ start: number; count: number; kind: 'weekend' | 'holiday' }> = [];
    let index = 0;
    while (index < dayList.length) {
      const day = dayList[index];
      if (!day.weekend && !day.holiday) {
        index += 1;
        continue;
      }
      const kind = day.holiday ? 'holiday' : 'weekend';
      let count = 0;
      while (
        index + count < dayList.length &&
        dayList[index + count].holiday === day.holiday &&
        dayList[index + count].weekend === day.weekend
      ) {
        count += 1;
      }
      result.push({ start: index, count, kind });
      index += count;
    }
    return result;
  }, [dayList]);

  const visibleNodes = useMemo(() => visibleTreeNodes(tree, collapsed), [tree, collapsed]);

  const rowIndex = useMemo(
    () => new Map(visibleNodes.map((node, index) => [node.task.id, index])),
    [visibleNodes],
  );

  const previewSchedule = useMemo(() => {
    if (!pendingTask) return null;
    const temp = { ...data, tasks: data.tasks.map((task) => (task.id === pendingTask.id ? pendingTask : task)) };
    return computeSchedule(temp);
  }, [data, pendingTask]);

  const activeSchedule = previewSchedule ?? schedule;
  const timelineWidth = days.length * dayWidth;

  const xOf = (iso: ISODate): number => diffInDays(parseISODate(range.start), parseISODate(iso)) * dayWidth;

  const today = todayISO();
  const todayInRange = today >= range.start && today <= range.end;

  useEffect(() => {
    if (!drag) return undefined;

    const handleMove = (event: PointerEvent) => {
      const delta = Math.round((event.clientX - drag.pointerX) / dayWidth);
      applyPending(computeDraggedTask(drag.original, drag.mode, delta, data.calendar));
    };

    const handleUp = () => {
      const next = pendingRef.current;
      const original = drag.original;
      if (next && (next.startDate !== original.startDate || next.duration !== original.duration)) {
        dispatch({ type: 'updateTask', task: next });
      }
      applyPending(null);
      setDrag(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [drag, dayWidth, data.calendar, dispatch]);

  const startDrag = (event: ReactPointerEvent, task: Task, mode: DragState['mode']) => {
    if (event.button !== 0) return;
    event.preventDefault();
    applyPending(task);
    setDrag({ taskId: task.id, mode, pointerX: event.clientX, original: task });
  };

  const scrollTo = (iso: ISODate) => {
    const element = scrollRef.current;
    if (!element) return;
    const offset = diffInDays(parseISODate(range.start), parseISODate(iso)) * dayWidth;
    element.scrollTo({
      left: Math.max(0, offset - element.clientWidth / 2 + 40),
      behavior: 'smooth',
    });
  };

  const toggleCollapse = (id: string) => setCollapsed((current) => toggleSet(current, id));

  const gridLines = useMemo(() => {
    const lines: Array<{ index: number; kind: 'month' | 'day' }> = [];
    for (const segment of months) lines.push({ index: segment.start, kind: 'month' });
    if (dayWidth >= 26) {
      for (let i = 0; i < dayList.length; i += 1) {
        if (dayList[i].weekday === 1) lines.push({ index: i, kind: 'day' });
      }
    }
    return lines;
  }, [months, dayWidth, dayList]);

  const bodyHeight = visibleNodes.length * ROW_HEIGHT;

  return (
    <div className="gantt">
      <div className="gantt__toolbar">
        <div className="zoom-group" aria-label="Zoom grafik">
          <button
            type="button"
            onClick={() => setDayWidth((value) => Math.max(DAY_MIN, value - 6))}
            aria-label="Perkecil"
          >
            −
          </button>
          <span>{Math.round((dayWidth / 34) * 100)}%</span>
          <button
            type="button"
            onClick={() => setDayWidth((value) => Math.min(DAY_MAX, value + 6))}
            aria-label="Perbesar"
          >
            +
          </button>
        </div>

        <button type="button" className="btn btn--sm" onClick={() => scrollTo(today)} disabled={!todayInRange}>
          Ke hari ini
        </button>

        <label className="resource-option" style={{ margin: 0 }}>
          <input type="checkbox" checked={showCritical} onChange={(e) => setShowCritical(e.target.checked)} />
          Jalur kritis
        </label>
        <label className="resource-option" style={{ margin: 0 }}>
          <input type="checkbox" checked={showFloat} onChange={(e) => setShowFloat(e.target.checked)} />
          Total float
        </label>

        <div className="gantt__legend" style={{ marginLeft: 'auto' }}>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: '#2563eb' }} /> Tugas
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: 'transparent', borderTop: '3px solid #0f172a', height: 0 }} />
            Tugas induk
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--weekend" /> Akhir pekan
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--holiday" /> Hari libur
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--critical" /> Jalur kritis
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--arrow" /> Dependensi
          </span>
        </div>
      </div>

      <div className="gantt__scroll" ref={scrollRef}>
        <div className="gantt__inner" style={{ width: `calc(var(--left-width) + ${timelineWidth}px)` }}>
          <div className="gantt__head">
            <div className="gantt__head-left">Tugas</div>
            <div className="gantt__head-right" style={{ width: timelineWidth }}>
              <div className="gantt__months">
                {months.map((segment) => (
                  <div
                    key={`${segment.year}-${segment.month}`}
                    className="gantt__month"
                    style={{ width: segment.count * dayWidth }}
                    title={`${segment.label} ${segment.year}`}
                  >
                    {segment.label} {segment.year}
                  </div>
                ))}
              </div>
              <div className="gantt__days">
                {dayList.map((day) => {
                  const isFirstOfMonth = day.dayOfMonth === 1;
                  const show = dayWidth >= 30 || day.weekday === 1 || isFirstOfMonth;
                  const classes = [
                    'gantt__day',
                    day.holiday ? 'gantt__day--holiday' : day.weekend ? 'gantt__day--weekend' : '',
                    day.iso === today ? 'gantt__day--today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <div key={day.iso} className={classes} style={{ width: dayWidth }}>
                      {show ? day.dayOfMonth : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="gantt__body">
            <div className="gantt__left">
              {visibleNodes.map((node) => {
                const nodeSchedule = activeSchedule.byId[node.task.id];
                const critical = showCritical && nodeSchedule?.isCritical;
                const classes = [
                  'gantt__row-left',
                  node.isSummary ? 'gantt__row-left--summary' : '',
                  critical ? 'gantt__row-left--critical' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div key={node.task.id} className={classes} style={{ paddingLeft: 8 + node.depth * 15 }}>
                    <button
                      type="button"
                      className={`chevron ${node.isSummary ? '' : 'chevron--hidden'}`}
                      onClick={() => toggleCollapse(node.task.id)}
                      aria-label={collapsed.has(node.task.id) ? 'Buka' : 'Tutup'}
                    >
                      {collapsed.has(node.task.id) ? '▶' : '▼'}
                    </button>
                    <span className="cell-name__dot" style={{ background: node.task.color }} />
                    <span className="gantt__task-label" title={node.task.name}>
                      {node.task.name}
                    </span>
                    <span className="gantt__task-meta">
                      {nodeSchedule ? `${nodeSchedule.duration}h` : ''}
                    </span>
                  </div>
                );
              })}
              {visibleNodes.length === 0 && (
                <div className="empty" style={{ padding: 24 }}>
                  Belum ada tugas.
                </div>
              )}
            </div>

            <div
              className="gantt__right"
              style={{ width: timelineWidth, height: Math.max(bodyHeight, 120) }}
            >
              <div className="gantt__grid">
                {bands.map((band) => (
                  <div
                    key={`${band.start}-${band.kind}`}
                    className={`gantt__band gantt__band--${band.kind}`}
                    style={{
                      left: band.start * dayWidth,
                      width: band.count * dayWidth,
                    }}
                  />
                ))}
                {gridLines.map((line) => (
                  <div
                    key={`${line.kind}-${line.index}`}
                    className={`gantt__gridline ${line.kind === 'month' ? 'gantt__gridline--month' : ''}`}
                    style={{ left: line.index * dayWidth }}
                  />
                ))}
                {todayInRange && <div className="gantt__today" style={{ left: xOf(today) + dayWidth / 2 }} />}
              </div>

              <svg className="gantt__links" width={timelineWidth} height={bodyHeight}>
                <defs>
                  <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0 0 L8 4 L0 8 Z" fill="#2563eb" />
                  </marker>
                  <marker id="gantt-arrow-critical" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0 0 L8 4 L0 8 Z" fill="#ef4444" />
                  </marker>
                </defs>
                {data.dependencies.map((dependency) => {
                  const fromIndex = rowIndex.get(dependency.predecessorId);
                  const toIndex = rowIndex.get(dependency.successorId);
                  if (fromIndex === undefined || toIndex === undefined) return null;
                  const from = activeSchedule.byId[dependency.predecessorId];
                  const to = activeSchedule.byId[dependency.successorId];
                  if (!from || !to) return null;

                  const isCritical = showCritical && from.isCritical && to.isCritical;

                  const y1 = fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const y2 = toIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const x1 =
                    dependency.type === 'FS'
                      ? xOf(from.earlyFinish) + dayWidth + 4
                      : xOf(from.earlyStart) - 6;
                  const x2 = xOf(to.earlyStart) - 5;
                  const elbow = x1 + 9;
                  const path =
                    x2 >= x1 + 14
                      ? `M ${x1} ${y1} L ${x2 - 9} ${y1} L ${x2 - 9} ${y2} L ${x2} ${y2}`
                      : `M ${x1} ${y1} L ${elbow} ${y1} L ${elbow} ${y2} L ${x2} ${y2}`;
                  const labelX = x2 - 6;
                  const showLabel = dayWidth >= 26;

                  return (
                    <g key={dependency.id}>
                      <path
                        className={`gantt__link ${isCritical ? 'gantt__link--critical' : ''}`}
                        d={path}
                        markerEnd={isCritical ? 'url(#gantt-arrow-critical)' : 'url(#gantt-arrow)'}
                      />
                      {showLabel && (
                        <text
                          className="pert-edge-label"
                          x={labelX}
                          y={y2 - 7}
                          textAnchor="middle"
                          stroke="#ffffff"
                          strokeWidth={3}
                          paintOrder="stroke"
                        >
                          {dependency.type}
                          {dependency.lag > 0 ? `+${dependency.lag}` : ''}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {visibleNodes.map((node, index) => (
                <div
                  key={`row-bg-${node.task.id}`}
                  className="gantt__row-bg"
                  style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              ))}

              <div className="gantt__bars">
                {visibleNodes.map((node, index) => {
                  const nodeSchedule = activeSchedule.byId[node.task.id];
                  if (!nodeSchedule) return null;
                  const top = index * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
                  const left = xOf(nodeSchedule.earlyStart);
                  const width =
                    (diffInDays(
                      parseISODate(nodeSchedule.earlyStart),
                      parseISODate(nodeSchedule.earlyFinish),
                    ) + 1) *
                      dayWidth -
                    4;
                  const critical = showCritical && nodeSchedule.isCritical;
                  const floatLeft = xOf(nodeSchedule.lateFinish) + dayWidth;
                  const floatWidth = Math.max(0, floatLeft - (left + width + 4));

                  const classes = [
                    'bar',
                    node.isSummary ? 'bar--summary' : '',
                    critical && !node.isSummary ? 'bar--critical' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div key={node.task.id}>
                      {showFloat && nodeSchedule.totalFloat > 0 && !node.isSummary && (
                        <div
                          className="bar__float"
                          style={{
                            position: 'absolute',
                            top: top + 6,
                            left: left + width + 4,
                            width: Math.max(4, floatWidth),
                            height: 10,
                          }}
                          title={`Total float: ${nodeSchedule.totalFloat} hari kerja`}
                        />
                      )}
                      <div
                        className={classes}
                        style={{
                          top,
                          left: left + 2,
                          width: Math.max(14, width),
                          background: node.task.color,
                          color: node.isSummary ? node.task.color : undefined,
                        }}
                        title={`${node.task.name}\n${formatShort(nodeSchedule.earlyStart)} → ${formatShort(
                          nodeSchedule.earlyFinish,
                        )}\nDurasi: ${nodeSchedule.duration} hari kerja${
                          nodeSchedule.totalFloat > 0 ? `\nFloat: ${nodeSchedule.totalFloat}` : '\nJalur kritis'
                        }`}
                        onPointerDown={(event) => startDrag(event, node.task, 'move')}
                        onDoubleClick={() => onEditTask?.(node.task)}
                      >
                        {!node.isSummary && node.task.progress > 0 && (
                          <div className="bar__progress" style={{ width: `${node.task.progress}%` }} />
                        )}
                        <span className="bar__label">
                          {width > 60 ? `${node.task.name}` : `${nodeSchedule.duration}h`}
                        </span>
                        {!node.isSummary && (
                          <>
                            <span
                              className="bar__handle bar__handle--start"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                startDrag(event, node.task, 'resize-start');
                              }}
                            />
                            <span
                              className="bar__handle bar__handle--end"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                startDrag(event, node.task, 'resize-end');
                              }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="gantt__hint">
        💡 Tarik bar untuk menggeser tanggal mulai, tarik ujung bar (kiri/kanan) untuk mengubah durasi hari
        kerja, klik dua kali untuk mengedit. Jadwal akhir tetap tunduk pada batas dependensi predecessor &
        hari libur. Rentang tampilan: {formatShort(range.start)} – {formatShort(range.end)} ({days.length} hari
        kalender).
      </div>
    </div>
  );
}
