# 野球手帳 ⚾

追中職（CPBL）用的個人手機/電腦兩用 PWA：賽程行事曆、進場紀錄（勝率/票價統計）、收藏品記帳、官方消息聚合。

## 功能

- **賽程行事曆**：整季一軍例行賽月曆，可依球隊篩選，顯示比分與主隊下一戰
- **進場紀錄**：記錄日期、票價、座位；對上官方賽程可依比分自動判定我隊勝敗，統計進場勝率、門票花費、下次進場倒數
- **收藏品**：收藏清單與分類花費，加上門票合計「棒球總花費」
- **消息**：CPBL 官網最新公告與各隊官方連結

個人資料只存在裝置的 localStorage，可在「進場」分頁匯出/匯入 JSON 備份。

## 開發

```bash
npm install
npm run update-data   # 從 CPBL 官網抓賽程與新聞 → public/data/*.json
npm run dev           # 開發伺服器
npm run build         # 產出 dist/
```

## 資料更新

`scripts/fetch-cpbl.mjs` 會處理官網 CDN 的 cookie 重導向與防偽 token，抓取：

- `POST /schedule/getgamedatas`（整季賽程與比分）
- `/news`（最新公告列表）

部署到 GitHub 後，`.github/workflows/update-data.yml` 每天台灣時間早上 6 點自動更新資料並 commit。搭配 GitHub Pages（或任何靜態主機）即可全自動運作。

## 在 iPhone 上當 App 用

用 Safari 開啟部署後的網址 → 分享 → 「加入主畫面」，即以獨立全螢幕視窗執行，支援離線瀏覽（最後一次載入的資料）。
