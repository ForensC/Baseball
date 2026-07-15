import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttendanceRecord, CollectionItem, Game, ThemeDay } from '../types';
import { team, teamLogo } from '../data/teams';
import { computeStats } from '../logic';
import { daysBetween, formatDateZh, formatMoney, todayISO } from '../utils';

export type Tab = 'home' | 'calendar' | 'records' | 'collection' | 'news';

const WD = '日一二三四五六';
// 由 ISO 日期加減天數，回傳 YYYY-MM-DD
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const DAY_RANGE = 7; // 首頁往前後可滑動的天數上限

interface Props {
  games: Game[];
  gamesById: Map<string, Game>;
  themeDays: ThemeDay[];
  records: AttendanceRecord[];
  items: CollectionItem[];
  favTeam: string;
  onQuickAdd: (g: Game) => void;
  onNavigate: (tab: Tab) => void;
}

function TeamMini({ code }: { code: string }) {
  return (
    <span className="mu">
      <img className="mu-logo" src={teamLogo(code)} alt="" />
      {team(code).short}
    </span>
  );
}

function GameRow({ g, action, onAction }: { g: Game; action: string; onAction: () => void }) {
  const final = g.status === 'final' && g.homeScore !== null && g.awayScore !== null;
  const meta = [
    g.status === 'postponed' ? '延賽' : g.time || '時間未定',
    g.stadium,
    `${team(g.home).short}主場`,
  ].join(' · ');
  return (
    <div className="game-item">
      <div className="game-mid">
        <div className="matchup">
          <TeamMini code={g.home} />
          <span className={`matchup-sep ${final ? 'score' : 'vs'}`}>
            {final ? `${g.homeScore} : ${g.awayScore}` : 'vs'}
          </span>
          <TeamMini code={g.away} />
        </div>
        <div className="game-line2">{meta}</div>
        {(g.homePitcher || g.awayPitcher) && (
          <div className="pitcher-line">
            <span className="ptag">先發</span>{g.homePitcher || '未定'} vs {g.awayPitcher || '未定'}
          </div>
        )}
      </div>
      <button className="btn-sm" onClick={onAction}>{action}</button>
    </div>
  );
}

// 首頁可左右滑動的「當天」大卡：上方日期切換、中央主打比賽、可滑到前後幾天
function DayHero({ g, dateLabel, relLabel, canPrev, canNext, onPrev, onNext }: {
  g?: Game; dateLabel: string; relLabel: string; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void;
}) {
  const final = !!g && g.status === 'final' && g.homeScore !== null && g.awayScore !== null;
  return (
    <div className="bigmatch">
      <div className="daynav">
        <button className="daynav-arrow" disabled={!canPrev} onClick={onPrev} aria-label="前一天">‹</button>
        <div className="daynav-center">
          <div className="daynav-date">{dateLabel}</div>
          <div className="daynav-rel">{relLabel}</div>
        </div>
        <button className="daynav-arrow" disabled={!canNext} onClick={onNext} aria-label="後一天">›</button>
      </div>
      {g ? (
        <>
          <div className="bigmatch-teams">
            <div className="bm-side">
              <img className="bm-logo-img" src={teamLogo(g.home)} alt={team(g.home).name} />
              <span className="bm-name">{team(g.home).name}</span>
              <span className="bm-ha">主場</span>
            </div>
            <div className="bm-center">{final ? `${g.homeScore} : ${g.awayScore}` : 'VS'}</div>
            <div className="bm-side">
              <img className="bm-logo-img" src={teamLogo(g.away)} alt={team(g.away).name} />
              <span className="bm-name">{team(g.away).name}</span>
              <span className="bm-ha">客場</span>
            </div>
          </div>
          <div className="bm-meta">{g.status === 'postponed' ? '延賽' : g.time || '時間未定'} · {g.stadium}</div>
          {(g.homePitcher || g.awayPitcher) && (
            <div className="bm-pitchers-line">
              <span className="ptag ptag-light">先發</span>{g.homePitcher || '未定'} vs {g.awayPitcher || '未定'}
            </div>
          )}
        </>
      ) : (
        <div className="bm-empty">這天沒有一軍賽事，左右滑動看其他天</div>
      )}
    </div>
  );
}

function BigMatchCta({ onAction }: { onAction: () => void }) {
  return (
    <div className="bm-cta">
      <button className="btn-primary" onClick={onAction}>計畫進場</button>
    </div>
  );
}

function CardHead({ title, more, onMore }: { title: string; more?: string; onMore?: () => void }) {
  return (
    <div className="card-head">
      <h2>{title}</h2>
      {more && <button className="link-more" onClick={onMore}>{more} ›</button>}
    </div>
  );
}

function PlanRow({ r, today }: { r: AttendanceRecord; today: string }) {
  const d = daysBetween(today, r.date);
  const when = d === 0 ? '今天' : d === 1 ? '明天' : `${d} 天後`;
  const [, m, day] = r.date.split('-');
  const wd = '日一二三四五六'[new Date(r.date + 'T00:00:00').getDay()];
  return (
    <div className="plan-row">
      <div className="plan-date">
        <div className="plan-md">{Number(m)}/{Number(day)}</div>
        <div className="plan-wd">週{wd}</div>
      </div>
      <img className="plan-logo" src={teamLogo(r.myTeam)} alt="" />
      <div className="plan-mid">
        <div className="plan-team">{team(r.myTeam).short}{r.opponent ? ` vs ${team(r.opponent).short}` : ''}</div>
        <div className="plan-sub">{r.stadium || '球場待定'}</div>
      </div>
      <div className={`plan-count ${d === 0 ? 'today' : ''}`}>{when}</div>
    </div>
  );
}

export default function HomeView({ games, gamesById, themeDays, records, items, favTeam, onQuickAdd, onNavigate }: Props) {
  const today = todayISO();

  const stats = useMemo(() => computeStats(records, gamesById), [records, gamesById]);
  const collectionTotal = useMemo(() => items.reduce((s, i) => s + (i.price || 0), 0), [items]);
  const grandTotal = stats.ticketTotal + collectionTotal;

  // 主頁只呈現一軍（kindCode A）；二軍在賽程分頁切換檢視
  const firstTeam = useMemo(() => games.filter((g) => g.kindCode === 'A'), [games]);
  const todayGames = useMemo(() => firstTeam.filter((g) => g.date === today), [firstTeam, today]);

  // 上方「當天」大卡＋賽事清單：可左右滑動切換日期（前後各 DAY_RANGE 天）
  // 預設落在今天；若今天沒球且 DAY_RANGE 天內有下一個比賽日，就先跳過去
  const defaultDate = useMemo(() => {
    if (todayGames.length) return today;
    const upcoming = firstTeam
      .map((g) => g.date)
      .filter((d) => d > today && daysBetween(today, d) <= DAY_RANGE)
      .sort()[0];
    return upcoming ?? today;
  }, [firstTeam, todayGames, today]);
  const [selectedDate, setSelectedDate] = useState(today);
  const userMovedRef = useRef(false);
  // 賽程資料是非同步載入的：使用者尚未手動滑動前，跟著預設日期走
  useEffect(() => {
    if (!userMovedRef.current) setSelectedDate(defaultDate);
  }, [defaultDate]);

  const selDiff = daysBetween(today, selectedDate);
  const canPrev = selDiff > -DAY_RANGE;
  const canNext = selDiff < DAY_RANGE;
  const move = (n: number) => {
    const nd = addDays(selectedDate, n);
    const diff = daysBetween(today, nd);
    if (diff < -DAY_RANGE || diff > DAY_RANGE) return;
    userMovedRef.current = true;
    setSelectedDate(nd);
  };
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return; // 只認明確的水平滑動
    move(dx < 0 ? 1 : -1);
  };

  const dayGames = useMemo(
    () => firstTeam.filter((g) => g.date === selectedDate).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [firstTeam, selectedDate]
  );
  // 主打比賽：有主隊且當天有出賽就用主隊那場，否則當天第一場
  const marquee = favTeam ? (dayGames.find((g) => g.home === favTeam || g.away === favTeam) ?? dayGames[0]) : dayGames[0];
  const dayTheme = marquee
    ? themeDays.find((t) => t.date === selectedDate && (t.team === marquee.home || t.team === marquee.away))
    : undefined;
  const wd = WD[new Date(selectedDate + 'T00:00:00').getDay()];
  const dateLabel = `${Number(selectedDate.slice(5, 7))}/${Number(selectedDate.slice(8, 10))}（${wd}）`;
  const relLabel = selDiff === 0 ? '今天' : selDiff === 1 ? '明天' : selDiff === -1 ? '昨天' : selDiff > 0 ? `${selDiff} 天後` : `${-selDiff} 天前`;

  // 我的看球計畫：未來（含今天）的進場紀錄，依日期由近到遠
  const plans = useMemo(
    () => records.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6),
    [records, today]
  );

  return (
    <>
      <div className="home-hi">
        <div className="home-date">{formatDateZh(today)}</div>
        <div className="home-greet">
          {todayGames.length ? `今天有 ${todayGames.length} 場比賽` : '今天沒有比賽'}
        </div>
      </div>

      <div className="day-pager" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="day-pager-content" key={selectedDate}>
          <div className="card hero-card bigmatch-card">
            <DayHero
              g={marquee}
              dateLabel={dateLabel}
              relLabel={relLabel}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={() => move(-1)}
              onNext={() => move(1)}
            />
          </div>
          {marquee && <BigMatchCta onAction={() => onQuickAdd(marquee)} />}
          {dayTheme && (
            <div className="theme-banner" style={{ borderColor: dayTheme.team ? team(dayTheme.team).color : 'var(--accent)' }}>
              <span className="theme-tag" style={{ background: dayTheme.team ? team(dayTheme.team).color : 'var(--accent)', color: dayTheme.team ? team(dayTheme.team).text : '#fff' }}>
                {dayTheme.team ? team(dayTheme.team).short : '主題日'}
              </span>
              <span>🎉 {dayTheme.name}</span>
            </div>
          )}
          {dayGames.length > 0 && (
            <div className="card">
              <CardHead title={`當天賽事（${dayGames.length}）`} more="月曆" onMore={() => onNavigate('calendar')} />
              {dayGames.map((g) => (
                <GameRow key={g.id} g={g} action="記進場" onAction={() => onQuickAdd(g)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {!favTeam && (
        <button className="btn-ghost" style={{ width: '100%' }} onClick={() => onNavigate('records')}>
          設定主隊，優先顯示你支持的球隊比賽 ›
        </button>
      )}

      <div className="card">
        <CardHead title="我的看球計畫" more="全部" onMore={() => onNavigate('records')} />
        {plans.length === 0 ? (
          <div className="empty">還沒有安排看球，到賽程點「計畫進場」加一場吧！</div>
        ) : (
          plans.map((r) => <PlanRow key={r.id} r={r} today={today} />)
        )}
      </div>

      <div className="card">
        <CardHead title="我的戰績" more="明細" onMore={() => onNavigate('records')} />
        <div className="stat-grid">
          <div className="stat"><div className="v">{stats.attended}</div><div className="k">進場場數</div></div>
          <div className="stat">
            <div className="v">{stats.winRate === null ? '－' : `${Math.round(stats.winRate * 100)}%`}</div>
            <div className="k">我隊勝率</div>
          </div>
          <div className="stat"><div className="v">{formatMoney(grandTotal)}</div><div className="k">棒球總花費</div></div>
        </div>
      </div>
    </>
  );
}
