/**
 * 野球手帳 — 進場紀錄 / 收藏品的雲端同步後端
 *
 * 部署方式：
 * 1. 開一個「私人」Google Sheet（不用公開），擴充功能 → Apps Script
 * 2. 貼上這整段，存檔
 * 3. 部署 → 新增部署作業 → 類型「網頁應用程式」
 *    執行身分 = 我、誰可以存取 = 任何人
 * 4. 複製結尾 /exec 的網址，貼進 app「進場」分頁的「雲端同步」欄位
 *
 * app 以 GET 讀取、POST（text/plain）覆寫；已實測可跨域。
 */
const SS = SpreadsheetApp.getActiveSpreadsheet();
const COLS = {
  records: ['id', 'date', 'gameId', 'myTeam', 'opponent', 'stadium', 'price', 'seat', 'result', 'note'],
  collection: ['id', 'name', 'category', 'price', 'date', 'team', 'note'],
};

function sheet(name) {
  let sh = SS.getSheetByName(name);
  if (!sh) { sh = SS.insertSheet(name); sh.appendRow(COLS[name]); }
  return sh;
}

function read(name) {
  const v = sheet(name).getDataRange().getValues();
  if (v.length < 2) return [];
  const head = v[0];
  return v.slice(1).filter(r => r.join('') !== '').map(r => {
    const o = {}; head.forEach((h, i) => o[h] = r[i]); return o;
  });
}

function write(name, rows) {
  const sh = sheet(name), head = COLS[name];
  sh.clearContents(); sh.appendRow(head);
  if (rows && rows.length) {
    const data = rows.map(o => head.map(h => o[h] != null ? String(o[h]) : ''));
    sh.getRange(2, 1, data.length, head.length).setNumberFormat('@').setValues(data);
  }
}

function doGet() {
  return out({ records: read('records'), collection: read('collection') });
}

function doPost(e) {
  const b = JSON.parse(e.postData.contents);
  if (b.records) write('records', b.records);
  if (b.collection) write('collection', b.collection);
  return out({ ok: true, updatedAt: new Date().toISOString() });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
