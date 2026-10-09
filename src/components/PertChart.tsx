import { useMemo } from 'react';
import { useProject } from '../state/ProjectContext';
import { computePertLevels } from '../lib/schedule';
import { formatShort } from '../lib/date';

const NODE_W = 216;
const NODE_H = 74;
const GAP_X = 64;
const GAP_Y = 22;
const PADDING = 16;

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export default function PertChart() {
  const { data, schedule } = useProject();

  const layout = useMemo(() => {
    const parents = new Set(data.tasks.map((task) => task.parentId).filter(Boolean));
    const leaves = data.tasks.filter((task) => !parents.has(task.id));
    const ids = leaves.map((task) => task.id);

    const dependencies = data.dependencies.filter(
      (dependency) => ids.includes(dependency.predecessorId) && ids.includes(dependency.successorId),
    );

    const levels = computePertLevels(ids, dependencies);
    const columns = new Map<number, string[]>();
    for (const id of ids) {
      const level = levels.get(id) ?? 0;
      columns.set(level, [...(columns.get(level) ?? []), id]);
    }

    const positions = new Map<string, { x: number; y: number }>();
    const levelKeys = [...columns.keys()].sort((a, b) => a - b);
    let maxRows = 0;
    for (const level of levelKeys) {
      const column = columns.get(level) ?? [];
      maxRows = Math.max(maxRows, column.length);
      column.forEach((id, index) => {
        positions.set(id, {
          x: PADDING + level * (NODE_W + GAP_X),
          y: PADDING + index * (NODE_H + GAP_Y),
        });
      });
    }

    const width = PADDING * 2 + Math.max(1, levelKeys.length) * NODE_W + Math.max(0, levelKeys.length - 1) * GAP_X;
    const height = PADDING * 2 + Math.max(1, maxRows) * NODE_H + Math.max(0, maxRows - 1) * GAP_Y;

    return { positions, width, height, dependencies, ids, order: levelKeys };
  }, [data.tasks, data.dependencies]);

  if (layout.ids.length === 0) {
    return (
      <div className="empty">
        <div className="empty__title">Diagram PERT belum tersedia</div>
        <p>Tambahkan tugas agar jaringan PERT dapat digambar.</p>
      </div>
    );
  }

  return (
    <div className="pert-wrap">
      <svg width={Math.max(layout.width, 480)} height={Math.max(layout.height, 260)} role="img" aria-label="Diagram PERT">
        <defs>
          <marker id="pert-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" fill="#94a3b8" />
          </marker>
          <marker id="pert-arrow-critical" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" fill="#ef4444" />
          </marker>
        </defs>

        {layout.dependencies.map((dependency) => {
          const from = layout.positions.get(dependency.predecessorId);
          const to = layout.positions.get(dependency.successorId);
          if (!from || !to) return null;
          const fromSchedule = schedule.byId[dependency.predecessorId];
          const toSchedule = schedule.byId[dependency.successorId];
          const critical =
            Boolean(fromSchedule?.isCritical) && Boolean(toSchedule?.isCritical);

          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const midX = x1 + Math.max(20, GAP_X / 2);
          const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

          return (
            <g key={dependency.id}>
              <path
                className={`pert-edge ${critical ? 'pert-edge--critical' : ''}`}
                d={path}
                markerEnd={critical ? 'url(#pert-arrow-critical)' : 'url(#pert-arrow)'}
              />
              <text
                className={`pert-edge-label ${critical ? 'pert-edge-label--critical' : ''}`}
                x={midX}
                y={(y1 + y2) / 2 - 4}
                textAnchor="middle"
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {dependency.type}
                {dependency.lag > 0 ? `+${dependency.lag}` : ''}
              </text>
            </g>
          );
        })}

        {layout.ids.map((id, index) => {
          const position = layout.positions.get(id);
          const nodeSchedule = schedule.byId[id];
          const task = data.tasks.find((item) => item.id === id);
          if (!position || !task || !nodeSchedule) return null;
          const critical = nodeSchedule.isCritical;

          return (
            <g key={id} transform={`translate(${position.x}, ${position.y})`}>
              <rect
                className={`pert-node ${critical ? 'pert-node--critical' : ''}`}
                width={NODE_W}
                height={NODE_H}
                rx={9}
              />
              <rect width={6} height={NODE_H} rx={3} fill={task.color} x={0} />
              <text className="pert-node__title" x={14} y={18}>
                {index + 1}. {truncate(task.name, 24)}
              </text>
              <text className="pert-node__meta" x={14} y={34}>
                Durasi {nodeSchedule.duration} hari kerja
              </text>
              <text className="pert-node__meta" x={14} y={48}>
                ES {formatShort(nodeSchedule.earlyStart)} · EF {formatShort(nodeSchedule.earlyFinish)}
              </text>
              <text className="pert-node__meta" x={14} y={61}>
                LS {formatShort(nodeSchedule.lateStart)} · LF {formatShort(nodeSchedule.lateFinish)}
              </text>
              <text
                className={`pert-node__float ${critical ? 'pert-node__float--critical' : ''}`}
                x={NODE_W - 12}
                y={34}
                textAnchor="end"
              >
                Float {nodeSchedule.totalFloat}h
              </text>
              {critical && (
                <text className="pert-node__float pert-node__float--critical" x={NODE_W - 12} y={61} textAnchor="end">
                  KRITIS
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
