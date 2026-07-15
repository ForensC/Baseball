import { useMemo, useRef, useState } from 'react';
import type { AttendanceRecord, Game, RecordResult } from '../types';
import { TEAMS, team } from '../data/teams';
import { computeStats, deriveResult } from '../logic';
import { daysBetween, formatDateZh, formatMoney, todayISO } from '../utils';
import { exportBackup, importBackup } from '../store';

interface Props {
  records: AttendanceRecord[];
  gamesById: Map<string, Game>;
  favTeam: string;
  onFavTeam: (code: string) => void;
  onAdd: () => void;
  onEdit: (r: AttendanceRecord) => void;
  onDelete: (id: string) => void;
  themeSheet: string;
  onThemeSheet: (v: string) => void;
  themeStatus: { status: 'idle' | 'loading' | 'ok' | 'error'; message: string };
  cloudUrl: string;
  onCloudUrl: (v: string) => void;
  syncState: { status: 'idle' | 'syncing' | 'ok' | 'error'; at?: string; message?: string };
}

const RESULT_STYLE: Record<RecordResult | 'plan', { label: string; color: string }> = {
  win: { label: '勝', color: 'var(--win)' },
  lose: { label: '敗', color: 'var(--lose)' },
  draw: { label: '和', color: 'var(--draw)' },
  pending: { label: '？', color: '#a16207' },
  plan: { label: '將', color: 'var(--plan)' },
};

// 結果快速篩選的顯示順序與標籤（比戰績圓標的單字更清楚）
const RESULT_ORDER: (RecordResult | 'plan')[] = ['win', 'lose', 'draw', 'pending', 'plan'];
const RESULT_FILTER_LABEL: Record<RecordResult | 'plan', string> = {
  win: '勝', lose: '敗', draw: '和', pending: '未定', plan: '計畫',
};

export default function RecordsView({ records, gamesById, favTeam, onFavTeam, onAdd, onEdit, onDelete, themeSheet, onThemeSheet, themeStatus, cloudUrl, onCloudUrl, syncState }: Props) {
  const today = todayISO();
  const stats = computeStats(records, gamesById);
  const fileRef = useRef<HTMLInputElement>(null);

  // 進場紀錄依年份篩選，一次只顯示一年，避免紀錄變多後列表落落長
  const years = useMemo(
    () => Array.from(new Set(records.map((r) => r.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [records]
  );
  const [year, setYear] = useState('');
  // 選定年份若已不存在（資料變動）則退回：優先今年、否則最近一年
  const activeYear = year && years.includes(year) ? year : (years.includes(today.slice(0, 4)) ? today.slice(0, 4) : years[0]);
  const shownRecords = useMemo(
    () => records.filter((r) => r.date.slice(0, 4) === activeYear).sort((a, b) => b.date.localeCompare(a.date)),
    [records, activeYear]
  );

  // 結果快速篩選：紀錄較多時才出現，避免少量紀錄時畫面太雜
  const resOf = (r: AttendanceRecord): RecordResult | 'plan' => (r.date > today ? 'plan' : deriveResult(r, gamesById));
  const resultsPresent = new Set(shownRecords.map(resOf));
  const availableResults = RESULT_ORDER.filter((k) => resultsPresent.has(k));
  const showResultFilter = shownRecords.length >= 8 && availableResults.length > 1;
  const [resultFilter, setResultFilter] = useState<RecordResult | 'plan' | ''>('');
  const appliedResult = showResultFilter && resultFilter && resultsPresent.has(resultFilter) ? resultFilter : '';
  const filteredRecords = appliedResult ? shownRecords.filter((r) => resOf(r) === appliedResult) : shownRecords;

  // 同一年跨多月時用月份分段
  const monthGroups: { month: string; items: AttendanceRecord[] }[] = [];
  for (const r of filteredRecords) {
    const m = r.date.slice(0, 7);
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.month === m) last.items.push(r);
    else monthGroups.push({ month: m, items: [r] });
  }

  const renderRow = (r: AttendanceRecord) => {
    const s = RESULT_STYLE[resOf(r)];
    return (
      <div key={r.id} className="rec-item">
        <span className="result-pill" style={{ background: s.color }}>{s.label}</span>
        <div className="rec-mid">
          <div className="rec-title">
            {formatDateZh(r.date)}｜{team(r.myTeam).short}
            {r.opponent ? ` vs ${team(r.opponent).short}` : ''}
          </div>
          <div className="rec-sub">
            {[r.stadium, r.seat, r.note].filter(Boolean).join('｜') || '－'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="rec-price">{r.price > 0 ? formatMoney(r.price) : ''}</div>
          <button className="icon-btn" onClick={() => onEdit(r)} aria-label="編輯">✏️</button>
          <button
            className="icon-btn"
            onClick={() => { if (confirm('確定刪除這筆進場紀錄？')) onDelete(r.id); }}
            aria-label="刪除"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  const doExport = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `yakyu-techo-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = (f: File | undefined) => {
    if (!f) return;
    f.text().then((txt) => {
      if (importBackup(txt)) location.reload();
      else alert('備份檔格式不正確');
    });
  };

  return (
    <>
      <div className="card hero-card">
        <h2>我的進場戰績</h2>
        <div className="hero-top">
          <div className="hero-label">我隊勝率</div>
          <div className="hero-num">{stats.winRate === null ? '－' : `${Math.round(stats.winRate * 100)}%`}</div>
          <div className="hero-detail">
            <span>{stats.wins} 勝</span><span>{stats.losses} 敗</span>{stats.draws > 0 && <span>{stats.draws} 和</span>}
          </div>
        </div>
      </div>
      <div className="hero-float">
        <div className="stat"><div className="v">{stats.attended}</div><div className="k">進場場數</div></div>
        <div className="stat"><div className="v">{stats.stadiums}</div><div className="k">去過的球場</div></div>
        <div className="stat"><div className="v">{formatMoney(stats.ticketTotal)}</div><div className="k">門票花費</div></div>
      </div>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat">
            <div className="v">{stats.avgPrice === null ? '－' : formatMoney(stats.avgPrice)}</div>
            <div className="k">平均票價</div>
          </div>
          <div className="stat">
            <div className="v">{stats.nextRecord ? `${daysBetween(today, stats.nextRecord.date)} 天` : '－'}</div>
            <div className="k">距離下次進場</div>
          </div>
        </div>
        {stats.nextRecord && (
          <p className="section-note">
            下次進場：{formatDateZh(stats.nextRecord.date)}
            {stats.nextRecord.stadium ? `＠${stats.nextRecord.stadium}` : ''}
          </p>
        )}
      </div>

      <button className="btn-primary" onClick={onAdd}>＋ 新增進場紀錄</button>

      <div className="card">
        <h2>進場紀錄{years.length ? ` · ${activeYear}` : ''}（{shownRecords.length}）</h2>
        {years.length > 1 && (
          <div className="chip-row" style={{ marginBottom: showResultFilter ? 2 : 6 }}>
            {years.map((y) => (
              <button
                key={y}
                className={`chip ${y === activeYear ? 'active' : ''}`}
                style={y === activeYear ? { background: 'var(--accent)', color: '#fff' } : undefined}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        )}
        {showResultFilter && (
          <div className="chip-row" style={{ marginBottom: 6 }}>
            <button
              className={`chip ${appliedResult === '' ? 'active' : ''}`}
              style={appliedResult === '' ? { background: 'var(--text)', color: 'var(--bg)' } : undefined}
              onClick={() => setResultFilter('')}
            >
              全部
            </button>
            {availableResults.map((k) => (
              <button
                key={k}
                className={`chip ${appliedResult === k ? 'active' : ''}`}
                style={appliedResult === k ? { background: RESULT_STYLE[k].color, color: '#fff' } : undefined}
                onClick={() => setResultFilter(k)}
              >
                {RESULT_FILTER_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        {records.length === 0 && <div className="empty">還沒有紀錄，看完球回來記一筆吧！</div>}
        {appliedResult && filteredRecords.length === 0 && (
          <div className="empty">這個年度沒有「{RESULT_FILTER_LABEL[appliedResult]}」的紀錄</div>
        )}
        {monthGroups.map((grp) => (
          <div key={grp.month}>
            {monthGroups.length > 1 && (
              <div className="rec-month">{Number(grp.month.slice(5))} 月<span className="rec-month-count">{grp.items.length} 場</span></div>
            )}
            {grp.items.map(renderRow)}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>設定</h2>
        <div className="field">
          <label>我的主隊（新增紀錄時預設、行事曆顯示下一場）</label>
          <select value={favTeam} onChange={(e) => onFavTeam(e.target.value)}>
            <option value="">未設定</option>
            {TEAMS.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={doExport}>匯出備份</button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>匯入備份</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => doImport(e.target.files?.[0])}
          />
        </div>
        <p className="section-note">所有紀錄只存在這台裝置的瀏覽器裡，換裝置前請先匯出備份。</p>
      </div>

      <div className="card">
        <h2>雲端同步（手機 ↔ 電腦）</h2>
        <div className="field">
          <label>貼上你的 Apps Script 網頁應用程式網址（結尾 /exec；留空＝不同步）</label>
          <input
            value={cloudUrl}
            onChange={(e) => onCloudUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
          />
        </div>
        {syncState.status !== 'idle' && (
          <p
            className="section-note"
            style={{ color: syncState.status === 'error' ? 'var(--lose)' : syncState.status === 'ok' ? 'var(--win)' : 'var(--muted)' }}
          >
            {syncState.status === 'syncing' && '⟳ 同步中…'}
            {syncState.status === 'ok' && `✓ 已同步${syncState.at ? '（' + new Date(syncState.at).toLocaleString('zh-Hant-TW') + '）' : ''}${syncState.message ? '，' + syncState.message : ''}`}
            {syncState.status === 'error' && `✕ ${syncState.message || '同步失敗'}`}
          </p>
        )}
        <p className="section-note">
          設定後，進場紀錄與收藏品會自動與你的私人 Google Sheet 雙向同步：開啟 app 時拉最新、
          你新增或修改時自動寫回。手機記一筆，電腦打開就看得到。
        </p>
      </div>

      <div className="card">
        <h2>主題日 Google Sheet</h2>
        <div className="field">
          <label>貼上你的 Google Sheet 連結或 ID（留空＝使用網站內建的預設主題日）</label>
          <input
            value={themeSheet}
            onChange={(e) => onThemeSheet(e.target.value)}
            placeholder="留空使用預設，或貼上 https://docs.google.com/spreadsheets/d/..."
          />
        </div>
        {themeStatus.status !== 'idle' && (
          <p
            className="section-note"
            style={{ color: themeStatus.status === 'error' ? 'var(--lose)' : themeStatus.status === 'ok' ? 'var(--win)' : 'var(--muted)' }}
          >
            {themeStatus.status === 'ok' ? '✓ ' : themeStatus.status === 'error' ? '✕ ' : ''}
            {themeStatus.message}
          </p>
        )}
        <p className="section-note">
          Sheet 第一列請放標題：<b>球隊、日期、主題日、連結</b>（連結可留空）。
          每一列一場主題日，例如「樂天桃猿、2026/7/5、Hello Kitty 主題日」。
          你在電腦或手機的 Google Sheet 更新後，重整 app 就會同步顯示。
        </p>
      </div>
    </>
  );
}
