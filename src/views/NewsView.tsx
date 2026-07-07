import type { NewsData } from '../types';
import { TEAMS } from '../data/teams';

export default function NewsView({ news }: { news: NewsData | null }) {
  return (
    <>
      <div className="card">
        <h2>官方連結</h2>
        <div className="link-row">
          <a href="https://www.cpbl.com.tw" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            CPBL 官網
          </a>
          {TEAMS.map((t) => (
            <a key={t.code} href={t.site} target="_blank" rel="noreferrer" style={{ color: t.color }}>
              {t.short}
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>CPBL 最新消息</h2>
        {!news && <div className="empty">尚未載入新聞資料，請先執行 npm run update-data</div>}
        {news?.items.map((n, i) => (
          <div key={i} className="news-item">
            <div className="news-date">{n.date}</div>
            <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
          </div>
        ))}
        {news && news.items.length === 0 && <div className="empty">目前沒有新聞</div>}
      </div>

      {news && (
        <p className="section-note">
          資料來源：CPBL 官網，更新於 {news.updatedAt.slice(0, 16).replace('T', ' ')}。
          部署後由 GitHub Actions 每日自動更新。
        </p>
      )}
    </>
  );
}
