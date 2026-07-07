import { useMemo } from 'react';
import type { AttendanceRecord, CollectionItem, Game, NewsData, ThemeDay } from '../types';
import { team } from '../data/teams';
import { computeStats } from '../logic';
import { daysBetween, formatDateZh, formatMoney, todayISO } from '../utils';
import TeamBadge from '../components/TeamBadge';

export type Tab = 'home' | 'calendar' | 'records' | 'collection' | 'news';

interface Props {
  games: Game[];
  gamesById: Map<string, Game>;
  themeDays: ThemeDay[];
  records: AttendanceRecord[];
  items: CollectionItem[];
  favTeam: string;
  news: NewsData | null;
  onQuickAdd: (g: Game) => void;
  onNavigate: (tab: Tab) => void;
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
          <TeamBadge code={g.home} />
          <span className={`matchup-sep ${final ? 'score' : 'vs'}`}>
            {final ? `${g.homeScore} : ${g.awayScore}` : 'vs'}
          </span>
          <TeamBadge code={g.away} />
        </div>
        <div className="game-line2">{meta}</div>
      </div>
      <button className="btn-sm" onClick={onAction}>{action}</button>
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

export default function HomeView({ games, gamesById, themeDays, records, items, favTeam, news, onQuickAdd, onNavigate }: Props) {
  const today = todayISO();

  const stats = useMemo(() => computeStats(records, gamesById), [records, gamesById]);
  const collectionTotal = useMemo(() => items.reduce((s, i) => s + (i.price || 0), 0), [items]);
  const grandTotal = stats.ticketTotal + collectionTotal;

  const todayGames = useMemo(() => games.filter((g) => g.date === today), [games, today]);
  const nextGameDate = useMemo(() => {
    if (todayGames.length) return today;
    return games.filter((g) => g.date > today).map((g) => g.date).sort()[0] ?? '';
  }, [games, today, todayGames]);
  const showGames = todayGames.length ? todayGames : games.filter((g) => g.date === nextGameDate);

  const favNext = useMemo(() => {
    if (!favTeam) return undefined;
    return games
      .filter((g) => g.date >= today && g.status === 'scheduled' && (g.home === favTeam || g.away === favTeam))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  }, [games, favTeam, today]);
  const favDays = favNext ? daysBetween(today, favNext.date) : null;
  const favTheme = favNext
    ? themeDays.find((t) => t.date === favNext.date && (t.team === favNext.home || t.team === favNext.away))
    : undefined;

  const upcomingThemes = useMemo(() => themeDays.filter((t) => t.date >= today).slice(0, 4), [themeDays, today]);
  const latestNews = news?.items.slice(0, 3) ?? [];

  return (
    <>
      <div className="home-hi">
        <div className="home-date">{formatDateZh(today)}</div>
        <div className="home-greet">
          {todayGames.length ? `今天有 ${todayGames.length} 場比賽` : '今天沒有比賽'}
        </div>
      </div>

      {favTeam ? (
        favNext && (
          <div className="card">
            <CardHead title={`${team(favTeam).short}的下一場`} more="賽程" onMore={() => onNavigate('calendar')} />
            <div className="focus-count">
              {favDays === 0 ? '今天開打！' : `還有 ${favDays} 天`}
            </div>
            <GameRow g={favNext} action="計畫進場" onAction={() => onQuickAdd(favNext)} />
            {favTheme && (
              <div className="theme-banner" style={{ borderColor: favTheme.team ? team(favTheme.team).color : 'var(--accent)' }}>
                <span className="theme-tag" style={{ background: favTheme.team ? team(favTheme.team).color : 'var(--accent)', color: favTheme.team ? team(favTheme.team).text : '#fff' }}>
                  {favTheme.team ? team(favTheme.team).short : '主題日'}
                </span>
                <span>🎉 {favTheme.name}</span>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="card">
          <CardHead title="設定你的主隊" />
          <p className="section-note" style={{ marginTop: 0 }}>設定主隊後，主頁會顯示他的下一場比賽與倒數。</p>
          <button className="btn-ghost" onClick={() => onNavigate('records')}>前往設定 ›</button>
        </div>
      )}

      <div className="card">
        <CardHead
          title={todayGames.length ? '今日賽事' : nextGameDate ? `下一個比賽日 ${nextGameDate.slice(5).replace('-', '/')}` : '賽事'}
          more="月曆"
          onMore={() => onNavigate('calendar')}
        />
        {showGames.length === 0 && <div className="empty">目前沒有安排中的比賽</div>}
        {showGames.map((g) => (
          <GameRow key={g.id} g={g} action="記進場" onAction={() => onQuickAdd(g)} />
        ))}
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
          <div className="stat">
            <div className="v">{stats.nextRecord ? `${daysBetween(today, stats.nextRecord.date)} 天` : '－'}</div>
            <div className="k">距離下次進場</div>
          </div>
        </div>
      </div>

      {upcomingThemes.length > 0 && (
        <div className="card">
          <CardHead title="接下來的主題日" more="行事曆" onMore={() => onNavigate('calendar')} />
          {upcomingThemes.map((t, i) => (
            <div key={i} className="theme-row">
              <span className="theme-tag" style={{ background: t.team ? team(t.team).color : 'var(--accent)', color: t.team ? team(t.team).text : '#fff' }}>
                {t.team ? team(t.team).short : '主題日'}
              </span>
              <span className="theme-date">{t.date.slice(5).replace('-', '/')}</span>
              <span className="theme-name">{t.name}</span>
            </div>
          ))}
        </div>
      )}

      {latestNews.length > 0 && (
        <div className="card">
          <CardHead title="最新消息" more="更多" onMore={() => onNavigate('news')} />
          {latestNews.map((n, i) => (
            <div key={i} className="news-item">
              <div className="news-date">{n.date}</div>
              <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
