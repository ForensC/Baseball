import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttendanceRecord, CollectionItem, Game, NewsData, ScheduleData, ThemeDay } from './types';
import { useStoredState } from './store';
import { fetchThemeDays } from './themedays';
import { pullCloud, pushCloud } from './sync';
import HomeView from './views/HomeView';
import CalendarView from './views/CalendarView';
import RecordsView from './views/RecordsView';
import CollectionView from './views/CollectionView';
import NewsView from './views/NewsView';
import RecordModal, { RecordDraft } from './components/RecordModal';

type Tab = 'home' | 'calendar' | 'records' | 'collection' | 'news';

// 網站預設主題日來源（作者維護的公開 Google Sheet）。
// 使用者可在「進場」分頁的設定欄位貼上自己的 Sheet 覆蓋。
const DEFAULT_THEME_SHEET = '1KQtXauU4aeBhEADD781CA7hBLyC3F9Aj108X8Ve4TyY';

const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: 'home', label: '首頁', ico: '🏠' },
  { id: 'calendar', label: '賽程', ico: '📅' },
  { id: 'records', label: '進場', ico: '🎟️' },
  { id: 'collection', label: '收藏', ico: '🧢' },
  { id: 'news', label: '消息', ico: '📰' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [news, setNews] = useState<NewsData | null>(null);
  const [records, setRecords] = useStoredState<AttendanceRecord[]>('records', []);
  const [items, setItems] = useStoredState<CollectionItem[]>('collection', []);
  const [favTeam, setFavTeam] = useStoredState<string>('favTeam', '');
  const [themeSheet, setThemeSheet] = useStoredState<string>('themeSheet', '');
  // 使用者沒自訂（空值）時，退回網站內建的預設主題日來源。
  // 不能只靠 useStoredState 的預設值，否則既有裝置存過的空值會蓋掉它。
  const effectiveSheet = themeSheet.trim() || DEFAULT_THEME_SHEET;
  const [themeDays, setThemeDays] = useState<ThemeDay[]>([]);
  const [themeStatus, setThemeStatus] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [draft, setDraft] = useState<RecordDraft | null>(null);

  // 進場/收藏的雲端同步（使用者自建的 Apps Script Web App）
  const [cloudUrl, setCloudUrl] = useStoredState<string>('cloudUrl', '');
  const [syncState, setSyncState] = useState<{ status: 'idle' | 'syncing' | 'ok' | 'error'; at?: string; message?: string }>({ status: 'idle' });
  const skipPushRef = useRef(false);   // 剛從雲端載入的資料不要立刻又推回去
  const pulledRef = useRef(false);     // 首次 pull 完成前不推送

  // cloudUrl 設定（含開啟 app）時，從雲端拉最新；雲端空但本地有資料則改為上傳本地
  useEffect(() => {
    const url = cloudUrl.trim();
    pulledRef.current = false;
    if (!url) { setSyncState({ status: 'idle' }); return; }
    let cancelled = false;
    setSyncState({ status: 'syncing', message: '同步中…' });
    pullCloud(url).then((cloud) => {
      if (cancelled) return;
      const cloudHas = cloud.records.length || cloud.collection.length;
      if (cloudHas) {
        skipPushRef.current = true;
        setRecords(cloud.records);
        setItems(cloud.collection);
        setSyncState({ status: 'ok', at: new Date().toISOString() });
        pulledRef.current = true;
      } else if (records.length || items.length) {
        pushCloud(url, { records, collection: items })
          .then(() => { if (!cancelled) { setSyncState({ status: 'ok', at: new Date().toISOString(), message: '已把本機資料上傳雲端' }); pulledRef.current = true; } })
          .catch(() => { if (!cancelled) setSyncState({ status: 'error', message: '上傳失敗' }); });
      } else {
        setSyncState({ status: 'ok', at: new Date().toISOString() });
        pulledRef.current = true;
      }
    }).catch(() => {
      if (!cancelled) setSyncState({ status: 'error', message: '連線失敗，請確認網址與存取權限' });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUrl]);

  // 進場/收藏變更時，debounce 推回雲端
  useEffect(() => {
    const url = cloudUrl.trim();
    if (!url || !pulledRef.current) return;
    if (skipPushRef.current) { skipPushRef.current = false; return; }
    setSyncState((s) => ({ ...s, status: 'syncing' }));
    const t = setTimeout(() => {
      pushCloud(url, { records, collection: items })
        .then(() => setSyncState({ status: 'ok', at: new Date().toISOString() }))
        .catch(() => setSyncState({ status: 'error', message: '上傳失敗' }));
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, items]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}data/schedule.json`).then((r) => r.json()).then(setSchedule).catch(() => {});
    fetch(`${base}data/news.json`).then((r) => r.json()).then(setNews).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setThemeStatus({ status: 'loading', message: '載入主題日中…' });
    fetchThemeDays(effectiveSheet).then((r) => {
      if (cancelled) return;
      setThemeDays(r.days);
      setThemeStatus({ status: r.status, message: r.message });
    });
    return () => { cancelled = true; };
  }, [effectiveSheet]);

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

      {tab === 'home' && (
        <HomeView
          games={games}
          gamesById={gamesById}
          themeDays={themeDays}
          records={records}
          items={items}
          favTeam={favTeam}
          news={news}
          onQuickAdd={quickAddFromGame}
          onNavigate={setTab}
        />
      )}
      {tab === 'calendar' && (
        <CalendarView
          games={games}
          records={records}
          favTeam={favTeam}
          themeDays={themeDays}
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
          themeSheet={themeSheet}
          onThemeSheet={setThemeSheet}
          themeStatus={themeStatus}
          cloudUrl={cloudUrl}
          onCloudUrl={setCloudUrl}
          syncState={syncState}
        />
      )}
      {tab === 'collection' && (
        <CollectionView items={items} setItems={setItems} records={records} themeDays={themeDays} />
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
