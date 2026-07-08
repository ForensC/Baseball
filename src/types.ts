export type GameStatus = 'scheduled' | 'final' | 'postponed';

export interface Game {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm，未定時為空字串
  kindCode: string; // A=一軍例行賽
  gameSno: number;
  away: string; // 球隊代碼
  home: string;
  stadium: string;
  awayScore: number | null;
  homeScore: number | null;
  status: GameStatus;
  awayPitcher?: string; // 先發投手名（含預告先發；未定時為空）
  homePitcher?: string;
}

export interface ScheduleData {
  updatedAt: string;
  year: number;
  source: string;
  games: Game[];
}

export interface NewsItem {
  date: string;
  title: string;
  url: string;
}

export interface NewsData {
  updatedAt: string;
  source: string;
  items: NewsItem[];
}

export interface ThemeDay {
  date: string; // YYYY-MM-DD
  team: string; // 球隊代碼；無法對應時為空字串
  name: string;
  url?: string;
}

export type RecordResult = 'win' | 'lose' | 'draw' | 'pending';

export interface AttendanceRecord {
  id: string;
  date: string;
  gameId?: string; // 有對上官方賽程時可自動判定勝負
  myTeam: string; // 我支持的球隊代碼
  opponent: string;
  stadium: string;
  price: number;
  seat?: string;
  result: RecordResult; // 手動填寫；有 gameId 時以比分自動判定為準
  note?: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  category: string;
  price: number;
  date: string;
  team?: string;
  note?: string;
}
