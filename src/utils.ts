export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatMoney(n: number): string {
  return 'NT$ ' + Math.round(n).toLocaleString('zh-Hant-TW');
}

export function formatDateZh(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = '日一二三四五六'[new Date(iso + 'T00:00:00').getDay()];
  return `${y}/${m}/${d}（${wd}）`;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
