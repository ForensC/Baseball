# 野球手帳 ⚾

追中職（CPBL）用的個人手機/電腦兩用 PWA：賽程行事曆、進場紀錄（勝率/票價統計）、收藏品記帳、官方消息聚合。

## 功能

- **賽程行事曆**：整季一軍例行賽月曆，可依球隊篩選，顯示比分與主隊下一戰
- **進場紀錄**：記錄日期、票價、座位；對上官方賽程可依比分自動判定我隊勝敗，統計進場勝率、門票花費、下次進場倒數
- **收藏品**：收藏清單與分類花費，加上門票合計「棒球總花費」
- **消息**：CPBL 官網最新公告與各隊官方連結
- **主題日**：從你自己維護的 Google Sheet 讀取各隊主題日，標記在行事曆上

個人資料存在裝置的 localStorage，可在「進場」分頁匯出/匯入 JSON 備份，或設定雲端同步（見下）跨裝置共用。

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

## 主題日（Google Sheet）

主題日不在 CPBL 官網、也沒有統一 API，所以改用「你自己維護、電腦手機共用」的 Google Sheet 當資料源：

1. 建一個 Google Sheet，第一列標題放：`球隊`、`日期`、`主題日`、`連結`（欄位順序可自由，`連結`可留空）
2. 每一列填一場主題日，例如：`樂天桃猿`、`2026/7/5`、`Hello Kitty 主題日`
3. 右上「共用」→ 一般存取權改為「知道連結的任何人」→ 檢視者
4. 複製網址，貼進 app「進場」分頁最下方的「主題日 Google Sheet」欄位

app 透過 Google 的 gviz CSV endpoint（`/gviz/tq?tqx=out:csv`）讀取，純前端、免登入、免後端；Google 會回應 CORS 標頭允許跨域讀取。之後你在 Sheet 增修，重整 app 就同步。球隊欄位可填全名或簡稱（自動對應），日期支援 `2026-07-05`、`2026/7/5`、`2026.7.5`。

## 雲端同步（進場紀錄 + 收藏品，手機 ↔ 電腦）

進場紀錄含個人資料，不適合放公開 Sheet，也無法用匿名端點寫入，因此改用 Google Apps Script Web App 當讀寫後端（以你的身分執行、存取一個私人 Sheet）：

1. 開一個私人 Google Sheet → 擴充功能 → Apps Script
2. 貼上 [`docs/sync-apps-script.gs`](docs/sync-apps-script.gs) 全部內容
3. 部署為「網頁應用程式」：執行身分 = 我、誰可以存取 = **任何人**（不是「任何 Google 帳戶」）
4. 複製結尾 `/exec` 的網址，貼進 app「進場」分頁的「雲端同步」欄位

之後進場紀錄與收藏品會自動雙向同步：開啟 app 時從 Sheet 拉最新、你新增/修改/刪除時自動寫回。app 端用 GET 讀、POST（`text/plain` 免 preflight）覆寫，Web App 回應帶 CORS，已實測可跨域。

## 在 iPhone 上當 App 用

用 Safari 開啟部署後的網址 → 分享 → 「加入主畫面」，即以獨立全螢幕視窗執行，支援離線瀏覽（最後一次載入的資料）。
