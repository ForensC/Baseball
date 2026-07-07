import { useRef } from 'react';
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
}

const RESULT_STYLE: Record<RecordResult | 'plan', { label: string; color: string }> = {
  win: { label: '勝', color: 'var(--win)' },
  lose: { label: '敗', color: 'var(--lose)' },
  draw: { label: '和', color: 'var(--draw)' },
  pending: { label: '？', color: '#a16207' },
  plan: { label: '將', color: 'var(--plan)' },
};

export default function RecordsView({ records, gamesById, favTeam, onFavTeam, onAdd, onEdit, onDelete }: Props) {
  const today = todayISO();
  const stats = computeStats(records, gamesById);
  const fileRef = useRef<HTMLInputElement>(null);

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
      <div className="card">
        <h2>我的進場戰績</h2>
        <div className="stat-grid">
          <div className="stat"><div className="v">{stats.attended}</div><div className="k">進場場數</div></div>
          <div className="stat">
            <div className="v">{stats.winRate === null ? '－' : `${Math.round(stats.winRate * 100)}%`}</div>
            <div className="k">我隊勝率 {stats.wins}勝{stats.losses}敗{stats.draws > 0 ? `${stats.draws}和` : ''}</div>
          </div>
          <div className="stat"><div className="v">{stats.stadiums}</div><div className="k">去過的球場</div></div>
          <div className="stat"><div className="v">{formatMoney(stats.ticketTotal)}</div><div className="k">門票總花費</div></div>
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
        <h2>進場紀錄（{records.length}）</h2>
        {records.length === 0 && <div className="empty">還沒有紀錄，看完球回來記一筆吧！</div>}
        {records.map((r) => {
          const res = r.date > today ? 'plan' : deriveResult(r, gamesById);
          const s = RESULT_STYLE[res];
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
        })}
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
    </>
  );
}
