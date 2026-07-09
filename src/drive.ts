// 把使用者貼的圖片網址轉成可直接 <img> 顯示的網址。
// Google Drive 的分享連結不能直接當圖片，需轉成 thumbnail endpoint
// （已實測 drive.google.com/thumbnail?id=... 可跨域載入；uc?export=view 會被擋）。

function extractDriveId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/, // .../file/d/ID/view
    /[?&]id=([a-zA-Z0-9_-]+)/, // ...?id=ID
    /\/d\/([a-zA-Z0-9_-]+)/, // .../d/ID
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// 顯示用網址：Drive 連結 → thumbnail；其他 http(s) 圖片 → 原樣
export function displayImage(raw: string | undefined, size = 1000): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (s.includes('drive.google.com') || s.includes('googleusercontent.com')) {
    const id = extractDriveId(s);
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
  }
  if (/^[a-zA-Z0-9_-]{25,}$/.test(s)) {
    // 使用者只貼了 Drive 檔案 ID
    return `https://drive.google.com/thumbnail?id=${s}&sz=w${size}`;
  }
  if (/^https?:\/\//.test(s)) return s;
  return '';
}
