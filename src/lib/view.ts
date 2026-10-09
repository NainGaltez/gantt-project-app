import type { TaskNode } from './schedule';

/** Menyaring daftar tugas berdasarkan induk yang sedang ditutup (collapsed). */
export function visibleTreeNodes(tree: TaskNode[], collapsed: Set<string>): TaskNode[] {
  const result: TaskNode[] = [];
  let hiddenBelow: number | null = null;
  for (const node of tree) {
    if (hiddenBelow !== null && node.depth > hiddenBelow) continue;
    hiddenBelow = null;
    result.push(node);
    if (node.isSummary && collapsed.has(node.task.id)) hiddenBelow = node.depth;
  }
  return result;
}

export function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
