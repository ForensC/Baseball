import { useMemo, useState } from 'react';
import type { AttendanceRecord, Game, ThemeDay } from '../types';
import { TEAMS, team, brandOf } from '../data/teams';
import { todayISO } from '../utils';
import TeamBadge from '../components/TeamBadge';

interface Props {
  games: Game[];
  records: AttendanceRecord[];
  favTeam: string;
  themeDays: ThemeDay[];
  onQuickAdd: (g: Game) => void;
  updatedAt?: string;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function CalendarView({ games, records, favTeam, themeDays, onQuickAdd, updatedAt }: Props) {
  const today = todayISO();
  const [ym, setYm] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [filter, setFilter] = useState('');
  const [tier, setTier] = useState<'A' | 'D'>('A'); // A=一軍、D=二軍

  // 主題日僅屬一軍賽事，二軍檢視時不顯示
  const themeByDate = useMemo(() => {
    const m = new Map<string, ThemeDay[]>();
    if (tier !== 'A') return m;
    for (const t of themeDays) {
      if (filter && t.team && brandOf(t.team) !== brandOf(filter)) continue;
      const arr = m.get(t.date) ?? [];
      arr.push(t);
      m.set(t.date, arr);
    }
    return m;
  }, [themeDays, filter, tier]);

  const filtered = useMemo(
    () => games.filter((g) =>
      g.kindCode === tier &&
      (!filter || brandOf(g.home) === brandOf(filter) || brandOf(g.away) === brandOf(filter))
    ),
    [games, filter, tier]
  );
  const byDate = useMemo(() => {
    const m = new Map<string, Game[]>();
    for (const g of filtered) {
      const arr = m.get(g.date) ?? [];
      arr.push(g);
      m.set(g.date, arr);
    }
    return m;
  }, [filtered]);
  const recordDates = useMemo(() => new Set(records.map((r) => r.date)), [records]);

  const [year, month] = ym.split('-').map(Number);
  const firstWd = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const shiftMonth = (d: number) => {
    const dt = new Date(year, month - 1 + d, 1);
    setYm(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  };

  const iso = (day: number) => `${ym}-${String(day).padStart(2, '0')}`;
  const dayGames = byDate.get(selected) ?? [];
  const dayThemes = themeByDate.get(selected) ?? [];

  return (
    <>
      <div className="tier-toggle">
        <button className={tier === 'A' ? 'active' : ''} onClick={() => setTier('A')}>一軍</button>
        <button className={tier === 'D' ? 'active' : ''} onClick={() => setTier('D')}>二軍</button>
      </div>

      <div className="chip-row">
        <button
          className={`chip ${filter === '' ? 'active' : ''}`}
          style={filter === '' ? { background: 'var(--accent)', color: '#fff' } : undefined}
          onClick={() => setFilter('')}
        >
          全部
        </button>
        {TEAMS.map((t) => (
          <button
            key={t.code}
            className={`chip ${filter === t.code ? 'active' : ''}`}
            style={filter === t.code ? { background: t.color, color: t.text } : undefined}
            onClick={() => setFilter(t.code)}
          >
            {t.short}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="cal-head">
          <button onClick={() => shiftMonth(-1)} aria-label="上個月">‹</button>
          <span className="title">{year} 年 {month} 月</span>
          <button onClick={() => shiftMonth(1)} aria-label="下個月">›</button>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
          {Array.from({ length: firstWd }).map((_, i) => <div key={'e' + i} className="cal-cell empty" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = iso(i + 1);
            const gs = byDate.get(d) ?? [];
            const themes = themeByDate.get(d) ?? [];
            return (
              <div
                key={d}
                className={`cal-cell ${d === selected ? 'selected' : ''} ${d === today ? 'today' : ''}`}
                onClick={() => setSelected(d)}
              >
                {recordDates.has(d) && <span className="went">⚾</span>}
                <div className="daynum">{i + 1}</div>
                {themes.length > 0 && (
                  <span
                    className="theme-dot"
                    style={{ background: themes[0].team ? team(themes[0].team).color : 'var(--accent)' }}
                    title={themes.map((t) => t.name).join('、')}
                  />
                )}
                <div className="games">
                  {gs.slice(0, 3).map((g) => (
                    <span key={g.id} className="matchbar" style={{ opacity: g.status === 'postponed' ? 0.35 : 1 }}>
                      <span style={{ background: team(g.away).color }} />
                      <span style={{ background: team(g.home).color }} />
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {ym !== today.slice(0, 7) && (
          <button
            className="btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => { setYm(today.slice(0, 7)); setSelected(today); }}
          >
            回到今天
          </button>
        )}
      </div>

      <div className="card">
        <h2>{selected.replaceAll('-', '/')} 的賽事</h2>
        {dayThemes.map((t, i) => (
          <div key={i} className="theme-banner" style={{ borderColor: t.team ? team(t.team).color : 'var(--accent)' }}>
            <span className="theme-tag" style={{ background: t.team ? team(t.team).color : 'var(--accent)', color: t.team ? team(t.team).text : '#fff' }}>
              {t.team ? team(t.team).short : '主題日'}
            </span>
            {t.url ? (
              <a href={t.url} target="_blank" rel="noreferrer">🎉 {t.name}</a>
            ) : (
              <span>🎉 {t.name}</span>
            )}
          </div>
        ))}
        {dayGames.length === 0 && <div className="empty">這天沒有{filter ? `${team(filter).short}的` : ''}比賽</div>}
        {dayGames.map((g) => {
          const final = g.status === 'final' && g.homeScore !== null && g.awayScore !== null;
          const meta = [
            g.status === 'postponed' ? '延賽' : g.time || '時間未定',
            g.stadium,
            `${team(g.home).short}主場`,
          ].join(' · ');
          return (
            <div key={g.id} className="game-item">
              <div className="game-mid">
                <div className="matchup">
                  <TeamBadge code={g.home} />
                  <span className={`matchup-sep ${final ? 'score' : 'vs'}`}>
                    {final ? `${g.homeScore} : ${g.awayScore}` : 'vs'}
                  </span>
                  <TeamBadge code={g.away} />
                </div>
                <div className="game-line2">{meta}</div>
              </div>
              <button className="btn-sm" onClick={() => onQuickAdd(g)}>記進場</button>
            </div>
          );
        })}
      </div>

      {favTeam && (
        <NextFavGame games={games} favTeam={favTeam} onQuickAdd={onQuickAdd} />
      )}
      {updatedAt && (
        <p className="section-note">賽程資料來源：CPBL 官網，更新於 {updatedAt.slice(0, 16).replace('T', ' ')}</p>
      )}
    </>
  );
}

function NextFavGame({ games, favTeam, onQuickAdd }: { games: Game[]; favTeam: string; onQuickAdd: (g: Game) => void }) {
  const today = todayISO();
  const next = games
    .filter((g) => g.date >= today && g.status === 'scheduled' && (g.home === favTeam || g.away === favTeam))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  if (!next) return null;
  return (
    <div className="card">
      <h2>{team(favTeam).short}的下一場比賽</h2>
      <div className="game-item">
        <div className="game-mid">
          <div className="matchup">
            <TeamBadge code={next.home} />
            <span className="matchup-sep vs">vs</span>
            <TeamBadge code={next.away} />
          </div>
          <div className="game-line2">
            {next.date.replaceAll('-', '/')} {next.time} · {next.stadium} · {team(next.home).short}主場
          </div>
        </div>
        <button className="btn-sm" onClick={() => onQuickAdd(next)}>計畫進場</button>
      </div>
    </div>
  );
}
