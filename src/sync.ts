import type { AttendanceRecord, CollectionItem, RecordResult } from './types';

// 進場/收藏的雲端同步：透過使用者自建的 Google Apps Script Web App 讀寫私人 Sheet。
// 已實測 GET/POST（text/plain 免 preflight）可跨域，回應帶 CORS。

export interface CloudData {
  records: AttendanceRecord[];
  collection: CollectionItem[];
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim();
const opt = (v: unknown) => str(v) || undefined;

function normRecord(r: Record<string, unknown>): AttendanceRecord {
  return {
    id: str(r.id) || Math.random().toString(36).slice(2),
    date: str(r.date),
    gameId: opt(r.gameId),
    myTeam: str(r.myTeam),
    opponent: str(r.opponent),
    stadium: str(r.stadium),
    price: Number(r.price) || 0,
    seat: opt(r.seat),
    result: (str(r.result) || 'pending') as RecordResult,
    note: opt(r.note),
  };
}

function normItem(i: Record<string, unknown>): CollectionItem {
  return {
    id: str(i.id) || Math.random().toString(36).slice(2),
    name: str(i.name),
    category: str(i.category),
    price: Number(i.price) || 0,
    date: str(i.date),
    team: opt(i.team),
    themeDay: opt(i.themeDay),
    significance: opt(i.significance),
    imageUrl: opt(i.imageUrl),
    note: opt(i.note),
  };
}

export async function pullCloud(url: string): Promise<CloudData> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return {
    records: Array.isArray(j.records) ? j.records.map(normRecord) : [],
    collection: Array.isArray(j.collection) ? j.collection.map(normItem) : [],
  };
}

export async function pushCloud(url: string, data: CloudData): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (!j.ok) throw new Error('寫入未成功');
}
