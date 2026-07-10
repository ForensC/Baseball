import { useMemo } from 'react';
import type { AttendanceRecord, CollectionItem, Game, NewsData, ThemeDay } from '../types';
import { team, teamLogo } from '../data/teams';
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

// 參考 BruceBaseball 的即將出賽大卡，兩側用隊色、中央 VS、下方先發投手對決
function BigMatch({ g, countdown, onAction }: { g: Game; countdown: string; onAction: () => void }) {
  const home = team(g.home);
  const away = team(g.away);
  const final = g.status === 'final' && g.homeScore !== null && g.awayScore !== null;
  return (
    <div className="bigmatch">
      <div className="bigmatch-top">
        <span className="bm-status">{countdown}</span>
        <span className="bm-when">{g.date.slice(5).replace('-', '/')}（{'日一二三四五六'[new Date(g.date + 'T00:00:00').getDay()]}）{g.time} · {g.stadium}</span>
      </div>
      <div className="bigmatch-teams">
        <div className="bm-side" style={{ background: home.color + '1f' }}>
          <img className="bm-logo-img" src={teamLogo(g.home)} alt={home.name} />
          <span className="bm-name">{home.name}</span>
          <span className="bm-ha">主場</span>
        </div>
        <div className="bm-center">{final ? `${g.homeScore} : ${g.awayScore}` : 'VS'}</div>
        <div className="bm-side" style={{ background: away.color + '1f' }}>
          <img className="bm-logo-img" src={teamLogo(g.away)} alt={away.name} />
          <span className="bm-name">{away.name}</span>
          <span className="bm-ha">客場</span>
        </div>
      </div>
      {(g.homePitcher || g.awayPitcher) && (
        <div className="bm-pitchers">
          <span className="bm-p">{g.homePitcher || '先發未定'}</span>
          <span className="bm-plabel">先發投手</span>
          <span className="bm-p">{g.awayPitcher || '先發未定'}</span>
        </div>
      )}
      <button className="btn-primary" style={{ marginTop: 12 }} onClick={onAction}>計畫進場</button>
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

  // 主頁只呈現一軍（kindCode A）；二軍在賽程分頁切換檢視
  const firstTeam = useMemo(() => games.filter((g) => g.kindCode === 'A'), [games]);
  const todayGames = useMemo(() => firstTeam.filter((g) => g.date === today), [firstTeam, today]);
  const nextGameDate = useMemo(() => {
    if (todayGames.length) return today;
    return firstTeam.filter((g) => g.date > today).map((g) => g.date).sort()[0] ?? '';
  }, [firstTeam, today, todayGames]);
  const showGames = todayGames.length ? todayGames : firstTeam.filter((g) => g.date === nextGameDate);

  const favNext = useMemo(() => {
    if (!favTeam) return undefined;
    return firstTeam
      .filter((g) => g.date >= today && g.status === 'scheduled' && (g.home === favTeam || g.away === favTeam))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  }, [firstTeam, favTeam, today]);
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
            <BigMatch
              g={favNext}
              countdown={favDays === 0 ? '今天開打！' : `還有 ${favDays} 天`}
              onAction={() => onQuickAdd(favNext)}
            />
            {favTheme && (
              <div className="theme-banner" style={{ borderColor: favTheme.team ? team(favTheme.team).color : 'var(--accent)', marginTop: 10 }}>
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
