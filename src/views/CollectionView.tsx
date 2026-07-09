import { useMemo, useState } from 'react';
import type { AttendanceRecord, CollectionItem, ThemeDay } from '../types';
import { TEAMS, team } from '../data/teams';
import { displayImage } from '../drive';
import { formatMoney, todayISO, uid } from '../utils';

const CATEGORIES = ['球衣', '帽子', '應援商品', '簽名球/卡', '公仔娃娃', '其他'];
const CAT_COLORS = ['#1e4b8f', '#e8b004', '#c8102e', '#0a6b5d', '#a50050', '#64748b'];
const CAT_EMOJI: Record<string, string> = {
  球衣: '👕', 帽子: '🧢', 應援商品: '📣', '簽名球/卡': '⚾', 公仔娃娃: '🧸', 其他: '📦',
};
const catColor = (c: string) => CAT_COLORS[Math.max(0, CATEGORIES.indexOf(c))];
const isTreasured = (i: CollectionItem) => !!i.significance?.trim();

interface Props {
  items: CollectionItem[];
  setItems: (fn: (prev: CollectionItem[]) => CollectionItem[]) => void;
  records: AttendanceRecord[];
  themeDays: ThemeDay[];
}

export default function CollectionView({ items, setItems, records, themeDays }: Props) {
  const [editing, setEditing] = useState<CollectionItem | 'new' | null>(null);
  const [viewing, setViewing] = useState<CollectionItem | null>(null);
  const [filter, setFilter] = useState('');

  const collectionTotal = items.reduce((s, i) => s + (i.price || 0), 0);
  const ticketTotal = records.reduce((s, r) => s + (r.price || 0), 0);
  const treasuredCount = items.filter(isTreasured).length;

  const cats = useMemo(() => CATEGORIES.filter((c) => items.some((i) => i.category === c)), [items]);
  const shown = useMemo(() => {
    if (filter === '__t') return items.filter(isTreasured);
    if (filter) return items.filter((i) => i.category === filter);
    return items;
  }, [items, filter]);

  const save = (item: CollectionItem) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === item.id);
      const next = i >= 0 ? prev.map((x) => (x.id === item.id ? item : x)) : [...prev, item];
      return next.sort((a, b) => b.date.localeCompare(a.date));
    });
    setEditing(null);
    setViewing(null);
  };
  const remove = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    setViewing(null);
  };

  // 依球隊分櫃：每隊一區，未填球隊歸「未分類」
  const groups = useMemo(() => {
    const m = new Map<string, CollectionItem[]>();
    for (const i of shown) {
      const key = i.team || '__none';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(i);
    }
    const order = [...TEAMS.map((t) => t.code), '__none'];
    return order.filter((k) => m.has(k)).map((k) => ({ key: k, items: m.get(k)! }));
  }, [shown]);

  const renderCard = (i: CollectionItem) => {
    const img = displayImage(i.imageUrl, 600);
    const treasured = isTreasured(i);
    return (
      <button key={i.id} className={`cab-card ${treasured ? 'treasured' : ''}`} onClick={() => setViewing(i)}>
        <div className="cab-img">
          {img ? (
            <img src={img} alt={i.name} loading="lazy" />
          ) : (
            <span className="cab-ph" style={{ background: catColor(i.category) + '22', color: catColor(i.category) }}>{CAT_EMOJI[i.category] || '📦'}</span>
          )}
          {treasured && <span className="cab-star">⭐</span>}
        </div>
        <div className="cab-body">
          <div className="cab-name">{i.name}</div>
          <div className="cab-meta">{i.date.replaceAll('-', '/')}</div>
          {treasured && <div className="cab-sig">{i.significance}</div>}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="card">
        <h2>我的收藏櫃</h2>
        <div className="stat-grid">
          <div className="stat"><div className="v">{items.length}</div><div className="k">收藏件數</div></div>
          <div className="stat"><div className="v">{formatMoney(collectionTotal)}</div><div className="k">收藏總值</div></div>
          <div className="stat"><div className="v">{formatMoney(collectionTotal + ticketTotal)}</div><div className="k">含門票合計</div></div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="chip-row">
          <button className={`chip ${filter === '' ? 'active' : ''}`} style={filter === '' ? { background: 'var(--accent)', color: '#fff' } : undefined} onClick={() => setFilter('')}>全部</button>
          {treasuredCount > 0 && (
            <button className={`chip ${filter === '__t' ? 'active' : ''}`} style={filter === '__t' ? { background: '#b45309', color: '#fff' } : undefined} onClick={() => setFilter('__t')}>⭐ 珍藏 {treasuredCount}</button>
          )}
          {cats.map((c) => (
            <button key={c} className={`chip ${filter === c ? 'active' : ''}`} style={filter === c ? { background: catColor(c), color: '#fff' } : undefined} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
      )}

      <button className="btn-primary" onClick={() => setEditing('new')}>＋ 新增收藏品</button>

      {items.length === 0 ? (
        <div className="card"><div className="empty">收藏櫃還是空的，把你的球衣、簽名球、應援小物加進來吧！</div></div>
      ) : shown.length === 0 ? (
        <div className="card"><div className="empty">這個分類沒有收藏品</div></div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="cab-group">
            <div className="cab-group-head">
              <span className="cab-dot" style={{ background: g.key === '__none' ? 'var(--muted)' : team(g.key).color }} />
              {g.key === '__none' ? '未分類' : team(g.key).name}
              <span className="cab-group-count">{g.items.length} 件</span>
            </div>
            <div className="cab-grid">{g.items.map(renderCard)}</div>
          </div>
        ))
      )}

      {viewing && (
        <DetailModal item={viewing} onEdit={() => { setEditing(viewing); setViewing(null); }} onDelete={() => { if (confirm(`確定刪除「${viewing.name}」？`)) remove(viewing.id); }} onClose={() => setViewing(null)} />
      )}
      {editing && (
        <ItemModal item={editing === 'new' ? null : editing} themeDays={themeDays} onSave={save} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function DetailModal({ item, onEdit, onDelete, onClose }: {
  item: CollectionItem; onEdit: () => void; onDelete: () => void; onClose: () => void;
}) {
  const img = displayImage(item.imageUrl, 1200);
  const treasured = isTreasured(item);
  const rows: [string, string][] = [
    ['分類', item.category],
    ['所屬球隊', item.team ? team(item.team).name : '－'],
    ['主題日', item.themeDay || '－'],
    ['購入日期', item.date.replaceAll('-', '/')],
    ['價格', item.price ? formatMoney(item.price) : '－'],
    ['筆記', item.note || '－'],
  ];
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-img">
          {img ? <img src={img} alt={item.name} /> : <span className="cab-ph big" style={{ background: catColor(item.category) + '22', color: catColor(item.category) }}>{CAT_EMOJI[item.category] || '📦'}</span>}
        </div>
        <h3 style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          {treasured && <span aria-label="珍藏">⭐</span>}{item.name}
        </h3>
        {treasured && (
          <div className="detail-sig">紀念價值：{item.significance}</div>
        )}
        <table className="detail-table">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onDelete} style={{ color: 'var(--lose)' }}>刪除</button>
          <button className="btn-ghost" onClick={onClose}>關閉</button>
          <button className="btn-primary" onClick={onEdit}>編輯</button>
        </div>
      </div>
    </div>
  );
}

function ItemModal({ item, themeDays, onSave, onClose }: {
  item: CollectionItem | null; themeDays: ThemeDay[]; onSave: (i: CollectionItem) => void; onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? CATEGORIES[0]);
  const [price, setPrice] = useState(item ? String(item.price || '') : '');
  const [date, setDate] = useState(item?.date ?? todayISO());
  const [teamCode, setTeamCode] = useState(item?.team ?? '');
  const [themeDay, setThemeDay] = useState(item?.themeDay ?? '');
  const [significance, setSignificance] = useState(item?.significance ?? '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [note, setNote] = useState(item?.note ?? '');

  // 主題日下拉：依球隊分組（optgroup），顯示完整年份，同名不同場次各自保留
  const themeVal = (t: ThemeDay) => `${t.date.replaceAll('-', '/')} ${t.name}`;
  const themeGroups = useMemo(() => {
    const m = new Map<string, ThemeDay[]>();
    for (const t of themeDays) {
      const key = t.team || '__none';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    const order = [...TEAMS.map((t) => t.code), '__none'];
    return order.filter((k) => m.has(k)).map((k) => ({
      label: k === '__none' ? '其他' : team(k).name,
      days: m.get(k)!.slice().sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }, [themeDays]);
  const themeValSet = useMemo(() => new Set(themeDays.map(themeVal)), [themeDays]);
  const preview = displayImage(imageUrl, 600);

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: item?.id ?? uid(),
      name: name.trim(),
      category,
      price: Number(price) || 0,
      date,
      team: teamCode || undefined,
      themeDay: themeDay || undefined,
      significance: significance.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{item ? '編輯收藏品' : '新增收藏品'}</h3>
        <div className="field">
          <label>名稱</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：王柏融簽名球" />
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
          <label>所屬主題日（選填）</label>
          <select value={themeDay} onChange={(e) => setThemeDay(e.target.value)}>
            <option value="">－</option>
            {themeDay && !themeValSet.has(themeDay) && <option value={themeDay}>{themeDay}</option>}
            {themeGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.days.map((t) => <option key={themeVal(t)} value={themeVal(t)}>{themeVal(t)}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label>紀念價值（填了就標為 ⭐ 珍藏）</label>
          <input value={significance} onChange={(e) => setSignificance(e.target.value)} placeholder="例：亞洲之鑽親筆簽名" />
        </div>
        <div className="field">
          <label>圖片網址（Google Drive 需設「知道連結的任何人可檢視」）</label>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="貼上 Drive 分享連結或圖片網址" />
          {preview && (
            <div className="img-preview"><img src={preview} alt="預覽" /></div>
          )}
        </div>
        <div className="field">
          <label>筆記</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="購入地點、故事⋯" />
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save}>儲存</button>
        </div>
      </div>
    </div>
  );
}
