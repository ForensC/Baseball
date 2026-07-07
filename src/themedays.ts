import type { ThemeDay } from './types';
import { TEAMS } from './data/teams';

// 主題日資料由使用者自己維護的公開 Google Sheet 提供（唯讀）。
// Sheet 需設為「知道連結的任何人 → 檢視者」，app 以 gviz CSV endpoint 讀取，
// 免登入、免後端，跨域已由 Google 允許（回傳 access-control-allow-origin）。

export interface ThemeDayResult {
  status: 'ok' | 'error';
  days: ThemeDay[];
  message: string;
}

// 從整個 Google Sheet 網址或純 ID 中取出 spreadsheet id
export function parseSheetId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s; // 使用者直接貼 ID
  return null;
}

function gvizCsvUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
}

// 解析一列 CSV（處理雙引號跳脫與欄位內逗號/換行）
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((x) => x !== '')) rows.push(row); }
  return rows;
}

// 把使用者填的球隊字樣（全名/簡稱/代碼）對應到球隊代碼
export function normalizeTeam(input: string): string {
  const s = input.trim();
  if (!s) return '';
  for (const t of TEAMS) {
    if (s === t.code) return t.code;
  }
  for (const t of TEAMS) {
    if (s.includes(t.short) || t.name.includes(s) || s.includes(t.name)) return t.code;
  }
  return '';
}

// 正規化日期字樣（2026-07-05 / 2026/7/5 / 2026.7.5 / Date(2026,6,5)）
function normalizeDate(input: string): string {
  const s = input.trim();
  const gviz = s.match(/Date\((\d+),(\d+),(\d+)/); // gviz 有時回 Date(year,monthIndex,day)
  if (gviz) {
    const [, y, mi, d] = gviz;
    return `${y}-${String(Number(mi) + 1).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`;
  }
  const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return '';
}

// 依標題列名稱找欄位位置，找不到就退回固定欄序（隊/日期/名稱/連結）
function columnIndexes(header: string[]) {
  const find = (keys: string[], fallback: number) => {
    const i = header.findIndex((h) => keys.some((k) => h.toLowerCase().includes(k)));
    return i >= 0 ? i : fallback;
  };
  return {
    team: find(['隊', 'team'], 0),
    date: find(['日期', 'date'], 1),
    name: find(['主題', '名稱', 'name', 'title', '活動'], 2),
    url: find(['連結', '網址', 'url', 'link'], 3),
  };
}

export async function fetchThemeDays(sheetInput: string): Promise<ThemeDayResult> {
  const id = parseSheetId(sheetInput);
  if (!id) return { status: 'error', days: [], message: '看不懂這個 Sheet 連結或 ID' };
  let text: string;
  try {
    const res = await fetch(gvizCsvUrl(id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch {
    return { status: 'error', days: [], message: '讀取失敗，請確認 Sheet 已設為「知道連結的任何人可檢視」' };
  }
  if (text.trimStart().startsWith('<')) {
    return { status: 'error', days: [], message: 'Sheet 未公開，Google 回傳了登入頁' };
  }
  const rows = parseCsv(text);
  if (rows.length < 2) return { status: 'ok', days: [], message: 'Sheet 是空的' };
  const col = columnIndexes(rows[0]);
  const days: ThemeDay[] = [];
  for (const r of rows.slice(1)) {
    const date = normalizeDate(r[col.date] ?? '');
    const name = (r[col.name] ?? '').trim();
    if (!date || !name) continue;
    const rawUrl = (r[col.url] ?? '').trim();
    days.push({
      date,
      team: normalizeTeam(r[col.team] ?? ''),
      name,
      url: /^https?:\/\//.test(rawUrl) ? rawUrl : undefined,
    });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { status: 'ok', days, message: `已載入 ${days.length} 筆主題日` };
}
