// 從 CPBL 官網抓取賽程與新聞，寫入 public/data/*.json
// 用法：node scripts/fetch-cpbl.mjs [年份]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

// CPBL 官網的 CDN 防護會「設 cookie 後重導向」，Node fetch 不會自動帶 cookie，
// 所以自己管理 cookie 並手動跟隨重導向。
const jar = new Map();
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

function storeCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function request(url, options = {}, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      let cur = url;
      for (let i = 0; i < 12; i++) {
        const res = await fetch(cur, {
          ...options,
          redirect: 'manual',
          headers: { 'User-Agent': UA, Cookie: cookieHeader(), ...options.headers },
        });
        storeCookies(res);
        if (res.status >= 300 && res.status < 400) {
          cur = new URL(res.headers.get('location'), cur).href;
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${cur}`);
        return res;
      }
      throw new Error('too many redirects: ' + url);
    } catch (e) {
      if (attempt >= tries) throw e;
      console.log(`  重試 ${attempt}/${tries - 1}：${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function fetchSchedule(year) {
  const page = await request('https://www.cpbl.com.tw/schedule');
  const html = await page.text();
  const tokenMatch = html.match(/RequestVerificationToken:\s*'([^']+)'/);
  if (!tokenMatch) throw new Error('找不到驗證 token，官網版面可能改版了');

  const res = await request('https://www.cpbl.com.tw/schedule/getgamedatas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: 'https://www.cpbl.com.tw/schedule',
      RequestVerificationToken: tokenMatch[1],
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: new URLSearchParams({ kindCode: 'A', year: String(year), month: '1' }).toString(),
  });
  const payload = await res.json();
  if (!payload.Success) throw new Error('getgamedatas 回傳失敗');
  const raw = JSON.parse(payload.GameDatas);

  const games = raw
    .filter((g) => g.GameDate)
    .map((g) => {
      const postponed = g.IsGameStop && g.IsGameStop !== '0';
      const finished = !postponed && g.GameDateTimeE != null;
      return {
        id: `${g.Year}-${g.KindCode}-${g.GameSno}`,
        date: g.GameDate.slice(0, 10),
        time: g.PreExeDate ? g.PreExeDate.slice(11, 16) : '',
        kindCode: g.KindCode,
        gameSno: g.GameSno,
        away: g.VisitingTeamCode,
        home: g.HomeTeamCode,
        stadium: g.FieldAbbe || '',
        awayScore: finished ? g.VisitingScore ?? null : null,
        homeScore: finished ? g.HomeScore ?? null : null,
        status: postponed ? 'postponed' : finished ? 'final' : 'scheduled',
      };
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  // 團隊代碼摘要，方便核對 teams.ts
  const codes = new Map();
  for (const g of raw) {
    codes.set(g.HomeTeamCode, g.HomeTeamName);
    codes.set(g.VisitingTeamCode, g.VisitingTeamName);
  }
  console.log('球隊代碼：', Object.fromEntries(codes));
  console.log(`賽程：共 ${games.length} 場（已完賽 ${games.filter((g) => g.status === 'final').length}、延賽 ${games.filter((g) => g.status === 'postponed').length}）`);

  return {
    updatedAt: new Date().toISOString(),
    year,
    source: 'https://www.cpbl.com.tw/schedule',
    games,
  };
}

async function fetchNews() {
  const res = await request('https://www.cpbl.com.tw/news');
  const html = await res.text();
  const items = [];
  const re = /<td class="date"[^>]*>([^<]+)<\/td>\s*<td class="title"[^>]*><a href="([^"]+)">([^<]+)<\/a>/g;
  for (const m of html.matchAll(re)) {
    items.push({
      date: m[1].trim(),
      url: new URL(m[2].replace(/&amp;/g, '&'), 'https://www.cpbl.com.tw').href,
      title: m[3].trim(),
    });
  }
  console.log(`新聞：共 ${items.length} 則`);
  return {
    updatedAt: new Date().toISOString(),
    source: 'https://www.cpbl.com.tw/news',
    items: items.slice(0, 40),
  };
}

const year = Number(process.argv[2]) || new Date().getFullYear();
await mkdir(OUT_DIR, { recursive: true });

let failed = false;
try {
  const schedule = await fetchSchedule(year);
  await writeFile(path.join(OUT_DIR, 'schedule.json'), JSON.stringify(schedule), 'utf8');
  console.log('已寫入 public/data/schedule.json');
} catch (e) {
  failed = true;
  console.error('賽程抓取失敗（保留舊檔）：', e.message);
}
try {
  const news = await fetchNews();
  await writeFile(path.join(OUT_DIR, 'news.json'), JSON.stringify(news), 'utf8');
  console.log('已寫入 public/data/news.json');
} catch (e) {
  failed = true;
  console.error('新聞抓取失敗（保留舊檔）：', e.message);
}
process.exit(failed ? 1 : 0);
