let counter = 0;

/** ID unik & cukup pendek untuk dipakai di localStorage. */
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 100000;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
}
