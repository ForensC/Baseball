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

// A=一軍例行賽、D=二軍例行賽
const KIND_CODES = ['A', 'D'];

async function fetchSchedule(year) {
  const page = await request('https://www.cpbl.com.tw/schedule');
  const html = await page.text();
  const tokenMatch = html.match(/RequestVerificationToken:\s*'([^']+)'/);
  if (!tokenMatch) throw new Error('找不到驗證 token，官網版面可能改版了');

  const codes = new Map();
  const rawAll = [];

  for (const kindCode of KIND_CODES) {
    const res = await request('https://www.cpbl.com.tw/schedule/getgamedatas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: 'https://www.cpbl.com.tw/schedule',
        RequestVerificationToken: tokenMatch[1],
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams({ kindCode, year: String(year), month: '1' }).toString(),
    });
    const payload = await res.json();
    if (!payload.Success) throw new Error(`getgamedatas(${kindCode}) 回傳失敗`);
    const raw = JSON.parse(payload.GameDatas).filter((g) => g.GameDate);
    rawAll.push(...raw);
    console.log(`kindCode=${kindCode}：${raw.length} 場`);
  }

  // 建 Acnt→球員名對照：預告先發（未來場次）通常只有投手帳號、名字為空，
  // 用已完賽場次的「名字+帳號」配對回填。
  const nameByAcnt = new Map();
  for (const g of rawAll) {
    for (const [a, n] of [
      [g.VisitingPitcherAcnt, g.VisitingPitcherName],
      [g.HomePitcherAcnt, g.HomePitcherName],
      [g.WinningPitcherAcnt, g.WinningPitcherName],
      [g.LoserPitcherAcnt, g.LoserPitcherName],
      [g.CloserAcnt, g.CloserName],
    ]) {
      if (a && n && n.trim()) nameByAcnt.set(a, n.trim());
    }
  }
  const pitcher = (name, acnt) => (name && name.trim()) || (acnt && nameByAcnt.get(acnt)) || '';

  const allGames = rawAll.map((g) => {
    const postponed = g.IsGameStop && g.IsGameStop !== '0';
    const finished = !postponed && g.GameDateTimeE != null;
    codes.set(g.HomeTeamCode, g.HomeTeamName);
    codes.set(g.VisitingTeamCode, g.VisitingTeamName);
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
      awayPitcher: pitcher(g.VisitingPitcherName, g.VisitingPitcherAcnt),
      homePitcher: pitcher(g.HomePitcherName, g.HomePitcherAcnt),
    };
  });

  allGames.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const withP = allGames.filter((g) => g.awayPitcher || g.homePitcher).length;
  console.log(`先發投手：${withP} 場有先發資料（對照 ${nameByAcnt.size} 位球員）`);

  console.log('球隊代碼：', Object.fromEntries(codes));
  console.log(`賽程合計：${allGames.length} 場（一軍 ${allGames.filter((g) => g.kindCode === 'A').length}、二軍 ${allGames.filter((g) => g.kindCode === 'D').length}）`);

  return {
    updatedAt: new Date().toISOString(),
    year,
    source: 'https://www.cpbl.com.tw/schedule',
    games: allGames,
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
