import { useEffect, useState } from 'react';

const PREFIX = 'yakyu.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 儲存空間滿或隱私模式時靜默失敗，資料仍在記憶體中
  }
}

export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => load(key, initial));
  useEffect(() => {
    save(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

export function exportBackup(): string {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
  }
  return JSON.stringify({ app: 'yakyu-techo', exportedAt: new Date().toISOString(), data }, null, 2);
}

export function importBackup(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (parsed.app !== 'yakyu-techo' || typeof parsed.data !== 'object') return false;
    for (const [k, v] of Object.entries(parsed.data)) save(k, v);
    return true;
  } catch {
    return false;
  }
}
