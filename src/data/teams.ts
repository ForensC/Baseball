export interface Team {
  code: string;
  name: string;
  short: string;
  color: string; // 主色
  text: string; // 主色上可讀的文字色
  site: string;
}

export const TEAMS: Team[] = [
  { code: 'ACN011', name: '中信兄弟', short: '兄弟', color: '#e8b004', text: '#3b2f00', site: 'https://www.brothers.tw' },
  { code: 'ADD011', name: '統一7-ELEVEn獅', short: '統一', color: '#ee7700', text: '#ffffff', site: 'https://www.uni-lions.com.tw' },
  { code: 'AJL011', name: '樂天桃猿', short: '樂天', color: '#a50050', text: '#ffffff', site: 'https://monkeys.rakuten.com.tw' },
  { code: 'AEO011', name: '富邦悍將', short: '富邦', color: '#1e4b8f', text: '#ffffff', site: 'https://www.fubonguardians.com' },
  { code: 'AAA011', name: '味全龍', short: '味全', color: '#c8102e', text: '#ffffff', site: 'https://www.wdragons.com' },
  { code: 'AKP011', name: '台鋼雄鷹', short: '台鋼', color: '#0a6b5d', text: '#ffffff', site: 'https://www.tsghawks.com' },
];

const byCode = new Map(TEAMS.map((t) => [t.code, t]));

// 球隊代碼前三碼代表「品牌」（同隊一二軍相同）：一軍 XXX011、二軍 XXX022。
export function brandOf(code: string): string {
  return code.slice(0, 3);
}

const byBrand = new Map(TEAMS.map((t) => [brandOf(t.code), t]));

export function team(code: string): Team {
  const exact = byCode.get(code);
  if (exact) return exact;
  // 二軍等其他代碼：沿用同品牌母隊的顏色與簡稱
  const brand = byBrand.get(brandOf(code));
  if (brand) return { ...brand, code };
  return {
    code,
    name: code,
    short: code.slice(0, 2),
    color: '#64748b',
    text: '#ffffff',
    site: 'https://www.cpbl.com.tw',
  };
}
