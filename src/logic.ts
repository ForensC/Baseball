import type { AttendanceRecord, Game, RecordResult } from './types';
import { todayISO } from './utils';

export function deriveResult(rec: AttendanceRecord, gamesById: Map<string, Game>): RecordResult {
  if (rec.gameId) {
    const g = gamesById.get(rec.gameId);
    if (g && g.status === 'final' && g.homeScore !== null && g.awayScore !== null) {
      const myIsHome = g.home === rec.myTeam;
      if (myIsHome || g.away === rec.myTeam) {
        const my = myIsHome ? g.homeScore : g.awayScore;
        const opp = myIsHome ? g.awayScore : g.homeScore;
        return my > opp ? 'win' : my < opp ? 'lose' : 'draw';
      }
    }
  }
  return rec.result;
}

export interface AttendanceStats {
  attended: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null; // 0~1，無勝敗場時為 null
  ticketTotal: number;
  avgPrice: number | null;
  stadiums: number;
  nextRecord: AttendanceRecord | null;
}

export function computeStats(records: AttendanceRecord[], gamesById: Map<string, Game>): AttendanceStats {
  const today = todayISO();
  const past = records.filter((r) => r.date <= today);
  const future = records
    .filter((r) => r.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  let wins = 0, losses = 0, draws = 0;
  for (const r of past) {
    const res = deriveResult(r, gamesById);
    if (res === 'win') wins++;
    else if (res === 'lose') losses++;
    else if (res === 'draw') draws++;
  }
  const ticketTotal = records.reduce((s, r) => s + (r.price || 0), 0);
  const priced = records.filter((r) => r.price > 0);
  return {
    attended: past.length,
    wins,
    losses,
    draws,
    winRate: wins + losses > 0 ? wins / (wins + losses) : null,
    ticketTotal,
    avgPrice: priced.length ? ticketTotal / priced.length : null,
    stadiums: new Set(past.map((r) => r.stadium).filter(Boolean)).size,
    nextRecord: future[0] ?? null,
  };
}
