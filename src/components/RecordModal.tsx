import { useMemo, useState } from 'react';
import type { AttendanceRecord, Game, RecordResult } from '../types';
import { TEAMS, team } from '../data/teams';
import { todayISO, uid } from '../utils';

export interface RecordDraft {
  editing?: AttendanceRecord;
  date?: string;
  gameId?: string;
  home?: string;
  away?: string;
  stadium?: string;
  myTeam?: string;
}

interface Props {
  draft: RecordDraft;
  games: Game[];
  onSave: (rec: AttendanceRecord) => void;
  onClose: () => void;
}

export default function RecordModal({ draft, games, onSave, onClose }: Props) {
  const e = draft.editing;
  const [date, setDate] = useState(e?.date ?? draft.date ?? todayISO());
  const [gameId, setGameId] = useState(e?.gameId ?? draft.gameId ?? '');
  const [myTeam, setMyTeam] = useState(e?.myTeam ?? draft.myTeam ?? TEAMS[0].code);
  const [opponent, setOpponent] = useState(e?.opponent ?? '');
  const [stadium, setStadium] = useState(e?.stadium ?? draft.stadium ?? '');
  const [price, setPrice] = useState(e ? String(e.price || '') : '');
  const [seat, setSeat] = useState(e?.seat ?? '');
  const [result, setResult] = useState<RecordResult>(e?.result ?? 'pending');
  const [note, setNote] = useState(e?.note ?? '');

  const dayGames = useMemo(() => games.filter((g) => g.date === date), [games, date]);
  const linked = gameId ? games.find((g) => g.id === gameId) : undefined;

  const pickGame = (id: string) => {
    setGameId(id);
    const g = games.find((x) => x.id === id);
    if (g) {
      setStadium(g.stadium);
      if (myTeam !== g.home && myTeam !== g.away) setMyTeam(g.home);
      setOpponent('');
    }
  };

  const changeDate = (d: string) => {
    setDate(d);
    if (linked && linked.date !== d) setGameId('');
  };

  const effOpponent = linked ? (myTeam === linked.home ? linked.away : linked.home) : opponent;
  const autoFinal = linked && linked.status === 'final' && linked.homeScore !== null;

  const save = () => {
    if (!myTeam || !date) return;
    onSave({
      id: e?.id ?? uid(),
      date,
      gameId: gameId || undefined,
      myTeam,
      opponent: effOpponent,
      stadium: stadium.trim(),
      price: Number(price) || 0,
      seat: seat.trim() || undefined,
      result,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <h3>{e ? '編輯進場紀錄' : '新增進場紀錄'}</h3>

        <div className="field">
          <label>日期</label>
          <input type="date" value={date} onChange={(ev) => changeDate(ev.target.value)} />
        </div>

        <div className="field">
          <label>對上官方賽程（可自動判定勝負）</label>
          <select value={gameId} onChange={(ev) => pickGame(ev.target.value)}>
            <option value="">不連結，自行輸入</option>
            {dayGames.map((g) => (
              <option key={g.id} value={g.id}>
                {team(g.away).short} vs {team(g.home).short}｜{g.stadium}
                {g.time ? `｜${g.time}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label>我支持的隊伍</label>
            <select value={myTeam} onChange={(ev) => setMyTeam(ev.target.value)}>
              {(linked ? [linked.home, linked.away] : TEAMS.map((t) => t.code)).map((c) => (
                <option key={c} value={c}>{team(c).name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>對手</label>
            {linked ? (
              <input value={team(effOpponent).name} disabled />
            ) : (
              <select value={opponent} onChange={(ev) => setOpponent(ev.target.value)}>
                <option value="">－</option>
                {TEAMS.filter((t) => t.code !== myTeam).map((t) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>球場</label>
            <input value={stadium} onChange={(ev) => setStadium(ev.target.value)} placeholder="例：大巨蛋" list="stadium-list" />
            <datalist id="stadium-list">
              {[...new Set(games.map((g) => g.stadium))].map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="field">
            <label>座位</label>
            <input value={seat} onChange={(ev) => setSeat(ev.target.value)} placeholder="例：內野 A12" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>票價（NT$）</label>
            <input type="number" inputMode="numeric" min="0" value={price} onChange={(ev) => setPrice(ev.target.value)} placeholder="0" />
          </div>
          <div className="field">
            <label>比賽結果</label>
            {autoFinal ? (
              <input value="依官方比分自動判定" disabled />
            ) : (
              <select value={result} onChange={(ev) => setResult(ev.target.value as RecordResult)}>
                <option value="pending">未定／尚未開打</option>
                <option value="win">我隊勝</option>
                <option value="lose">我隊敗</option>
                <option value="draw">和局</option>
              </select>
            )}
          </div>
        </div>

        <div className="field">
          <label>筆記</label>
          <textarea rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="今天的先發、MVP、心得⋯" />
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save}>儲存</button>
        </div>
      </div>
    </div>
  );
}
