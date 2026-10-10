export function formatSeconds(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  return `${s.toFixed(1)}초`;
}

export function quote(text: string): string {
  return `“${text}”`;
}
