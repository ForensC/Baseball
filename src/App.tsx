import { useEffect, useMemo, useState } from 'react';
import type { AttendanceRecord, CollectionItem, Game, NewsData, ScheduleData } from './types';
import { useStoredState } from './store';
import CalendarView from './views/CalendarView';
import RecordsView from './views/RecordsView';
import CollectionView from './views/CollectionView';
import NewsView from './views/NewsView';
import RecordModal, { RecordDraft } from './components/RecordModal';

type Tab = 'calendar' | 'records' | 'collection' | 'news';

const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: 'calendar', label: '賽程', ico: '📅' },
  { id: 'records', label: '進場', ico: '🎟️' },
  { id: 'collection', label: '收藏', ico: '🧢' },
  { id: 'news', label: '消息', ico: '📰' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('calendar');
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [news, setNews] = useState<NewsData | null>(null);
  const [records, setRecords] = useStoredState<AttendanceRecord[]>('records', []);
  const [items, setItems] = useStoredState<CollectionItem[]>('collection', []);
  const [favTeam, setFavTeam] = useStoredState<string>('favTeam', '');
  const [draft, setDraft] = useState<RecordDraft | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}data/schedule.json`).then((r) => r.json()).then(setSchedule).catch(() => {});
    fetch(`${base}data/news.json`).then((r) => r.json()).then(setNews).catch(() => {});
  }, []);

  const games = schedule?.games ?? [];
  const gamesById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const saveRecord = (rec: AttendanceRecord) => {
    setRecords((prev) => {
      const i = prev.findIndex((r) => r.id === rec.id);
      const next = i >= 0 ? prev.map((r) => (r.id === rec.id ? rec : r)) : [...prev, rec];
      return next.sort((a, b) => b.date.localeCompare(a.date));
    });
    setDraft(null);
  };

  const quickAddFromGame = (g: Game) => {
    setDraft({
      date: g.date,
      gameId: g.id,
      home: g.home,
      away: g.away,
      stadium: g.stadium,
      myTeam: favTeam && (favTeam === g.home || favTeam === g.away) ? favTeam : g.home,
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>野球手帳</h1>
        <span className="sub">CPBL 追賽紀錄</span>
      </header>

      {tab === 'calendar' && (
        <CalendarView
          games={games}
          records={records}
          favTeam={favTeam}
          onQuickAdd={quickAddFromGame}
          updatedAt={schedule?.updatedAt}
        />
      )}
      {tab === 'records' && (
        <RecordsView
          records={records}
          gamesById={gamesById}
          favTeam={favTeam}
          onFavTeam={setFavTeam}
          onAdd={() => setDraft({ myTeam: favTeam })}
          onEdit={(r) => setDraft({ editing: r })}
          onDelete={(id) => setRecords((prev) => prev.filter((r) => r.id !== id))}
        />
      )}
      {tab === 'collection' && (
        <CollectionView items={items} setItems={setItems} records={records} />
      )}
      {tab === 'news' && <NewsView news={news} />}

      {draft && (
        <RecordModal
          draft={draft}
          games={games}
          onSave={saveRecord}
          onClose={() => setDraft(null)}
        />
      )}

      <nav className="tabbar">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <span className="ico">{t.ico}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
