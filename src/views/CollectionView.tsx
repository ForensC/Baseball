import { useMemo, useState } from 'react';
import type { AttendanceRecord, CollectionItem } from '../types';
import { TEAMS, team } from '../data/teams';
import { formatMoney, todayISO, uid } from '../utils';

const CATEGORIES = ['球衣', '帽子', '應援商品', '簽名球/卡', '公仔娃娃', '其他'];
const CAT_COLORS = ['#1e4b8f', '#e8b004', '#c8102e', '#0a6b5d', '#a50050', '#64748b'];

interface Props {
  items: CollectionItem[];
  setItems: (fn: (prev: CollectionItem[]) => CollectionItem[]) => void;
  records: AttendanceRecord[];
}

export default function CollectionView({ items, setItems, records }: Props) {
  const [editing, setEditing] = useState<CollectionItem | 'new' | null>(null);

  const collectionTotal = items.reduce((s, i) => s + (i.price || 0), 0);
  const ticketTotal = records.reduce((s, r) => s + (r.price || 0), 0);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.category, (m.get(i.category) ?? 0) + (i.price || 0));
    return CATEGORIES.map((c, idx) => ({ cat: c, total: m.get(c) ?? 0, color: CAT_COLORS[idx] }))
      .filter((x) => x.total > 0);
  }, [items]);

  const save = (item: CollectionItem) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === item.id);
      const next = i >= 0 ? prev.map((x) => (x.id === item.id ? item : x)) : [...prev, item];
      return next.sort((a, b) => b.date.localeCompare(a.date));
    });
    setEditing(null);
  };

  return (
    <>
      <div className="card">
        <h2>棒球總花費</h2>
        <div className="stat-grid">
          <div className="stat"><div className="v">{formatMoney(collectionTotal)}</div><div className="k">收藏品（{items.length} 件）</div></div>
          <div className="stat"><div className="v">{formatMoney(ticketTotal)}</div><div className="k">門票</div></div>
          <div className="stat"><div className="v">{formatMoney(collectionTotal + ticketTotal)}</div><div className="k">合計</div></div>
        </div>
        {byCat.length > 0 && (
          <>
            <div className="catbar">
              {byCat.map((x) => (
                <span key={x.cat} style={{ background: x.color, flexGrow: x.total }} />
              ))}
            </div>
            <div className="cat-legend">
              {byCat.map((x) => (
                <span key={x.cat}>
                  <span className="cat-dot" style={{ background: x.color }} />
                  {x.cat} {formatMoney(x.total)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <button className="btn-primary" onClick={() => setEditing('new')}>＋ 新增收藏品</button>

      <div className="card">
        <h2>收藏清單</h2>
        {items.length === 0 && <div className="empty">還沒有收藏品，快去球場周邊補貨！</div>}
        {items.map((i) => (
          <div key={i.id} className="rec-item">
            <span
              className="result-pill"
              style={{ background: CAT_COLORS[Math.max(0, CATEGORIES.indexOf(i.category))], fontSize: 11 }}
            >
              {i.category.slice(0, 2)}
            </span>
            <div className="rec-mid">
              <div className="rec-title">{i.name}</div>
              <div className="rec-sub">
                {[i.date.replaceAll('-', '/'), i.team ? team(i.team).short : '', i.note].filter(Boolean).join('｜')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="rec-price">{formatMoney(i.price)}</div>
              <button className="icon-btn" onClick={() => setEditing(i)} aria-label="編輯">✏️</button>
              <button
                className="icon-btn"
                onClick={() => { if (confirm(`確定刪除「${i.name}」？`)) setItems((prev) => prev.filter((x) => x.id !== i.id)); }}
                aria-label="刪除"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ItemModal
          item={editing === 'new' ? null : editing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ItemModal({ item, onSave, onClose }: {
  item: CollectionItem | null;
  onSave: (i: CollectionItem) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? CATEGORIES[0]);
  const [price, setPrice] = useState(item ? String(item.price || '') : '');
  const [date, setDate] = useState(item?.date ?? todayISO());
  const [teamCode, setTeamCode] = useState(item?.team ?? '');
  const [note, setNote] = useState(item?.note ?? '');

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: item?.id ?? uid(),
      name: name.trim(),
      category,
      price: Number(price) || 0,
      date,
      team: teamCode || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <h3>{item ? '編輯收藏品' : '新增收藏品'}</h3>
        <div className="field">
          <label>名稱</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：兄弟主場球衣" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>分類</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>價格（NT$）</label>
            <input type="number" inputMode="numeric" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>購入日期</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>所屬球隊</label>
            <select value={teamCode} onChange={(e) => setTeamCode(e.target.value)}>
              <option value="">－</option>
              {TEAMS.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>筆記</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="購入地點、紀念意義⋯" />
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save}>儲存</button>
        </div>
      </div>
    </div>
  );
}
