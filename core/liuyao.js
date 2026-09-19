// 六爻：三钱法起卦 + 京房八宫装卦
import {
  ORDER, YAO, GUA_WX, ZHI, NAJIA, SHI_POS, SEQ_NAME,
  guaName, liuShenStart, xunKong, liuQin, LIUSHEN,
} from './data.js';

// 由六爻（初→上）反查内外卦名
function yaoToGua(y) {
  const find = (t) => ORDER.find((g) => YAO[g].join('') === t.join(''));
  return { 内: find(y.slice(0, 3)), 外: find(y.slice(3, 6)) };
}

// 生成 64 卦的宫属与世爻（京房八宫规则，纯推导不用查表）
const PALACE = (() => {
  const map = {};
  const flip = (a, i) => { const c = [...a]; c[i] ^= 1; return c; };
  for (const gong of ORDER) {
    const base = [...YAO[gong], ...YAO[gong]];
    const seq = [base];
    let cur = base;
    for (let i = 0; i < 5; i++) { cur = flip(cur, i); seq.push(cur); }
    const you = flip(seq[5], 3);            // 游魂：五世再变四爻
    seq.push(you);
    const gui = [...you];                   // 归魂：游魂内卦全变
    gui[0] ^= 1; gui[1] ^= 1; gui[2] ^= 1;
    seq.push(gui);
    seq.forEach((y, i) => {
      map[y.join('')] = { gong, shi: SHI_POS[i], seq: SEQ_NAME[i] };
    });
  }
  return map;
})();

// 单爻结果的理论分布
//   三钱法：三枚铜钱，字=2 背=3 → 6老阴 7少阳 8少阴 9老阳，阴阳各半
//   大衍筮法：蓍草十八变，老阳明显偏多，老阳:老阴 = 3:1
export const DAYAN_P = { 6: 1 / 16, 7: 5 / 16, 8: 7 / 16, 9: 3 / 16 };

// 单爻。大衍不必真去模拟分揲挂扐 —— 十八变之后每爻的分布就是上面那个定值，
// 按分布直接抽样与之严格同分布，还省掉一大坨易错的蓍草流程。
// 三枚铜钱各自的字/背：2 = 字（阴面）、3 = 背（阳面）。三钱法就是这三枚之和。
// 单独导出来是给界面用的 —— 落定后的铜钱要停在**真掷出来的那一面**上，
// 光有一个和（7 = 两个字一个背）反推不出是哪一枚，得把这三枚本身留下来。
// 取数顺序必须跟原来那个 for 循环一致，换个写法同一种子就抽出不同的卦。
export const tossCoins = (rand = Math.random) =>
  [0, 0, 0].map(() => (rand() < 0.5 ? 2 : 3));
export const coinsToLine = (coins) => coins.reduce((a, b) => a + b, 0);

export function tossLine(method = 'coin', rand = Math.random) {
  if (method === 'dayan') {
    const r = rand();
    let acc = 0;
    for (const v of [6, 7, 8, 9]) { acc += DAYAN_P[v]; if (r < acc) return v; }
    return 9;
  }
  return coinsToLine(tossCoins(rand));
}

// 装卦：对一组爻值（自下而上）排出完整卦盘
export function paipan(lines, dayGanZhi) {
  // lines: [{v:6|7|8|9}, ...] 或直接 [6,7,8,9,...]
  const vals = lines.map((l) => (typeof l === 'object' ? l.v : l));
  const ben = vals.map((v) => (v === 7 || v === 9 ? 1 : 0));      // 本卦阴阳
  const dong = vals.map((v) => v === 6 || v === 9);                // 动爻
  const bian = ben.map((b, i) => (dong[i] ? b ^ 1 : b));           // 变卦

  const mk = (yao, src) => {
    const key = yao.join('');
    const p = PALACE[key];
    const { 内, 外 } = yaoToGua(yao);
    const gongWx = GUA_WX[p.gong];
    const najia = [...NAJIA[内].内, ...NAJIA[外].外];
    return {
      卦: guaName(外, 内), 上卦: 外, 下卦: 内, 宫: p.gong, 宫五行: gongWx,
      世应序: p.seq, 世爻: p.shi, 应爻: p.shi <= 3 ? p.shi + 3 : p.shi - 3,
      六亲: najia.map((n) => liuQin(gongWx, n[1])),
      纳甲: najia,
      爻: yao, src,
    };
  };

  const 本卦 = mk(ben, vals);
  const 变卦 = dong.some(Boolean) ? mk(bian, vals) : null;

  // 六神自初爻起，按日干定起点
  const start = liuShenStart(dayGanZhi[0]);
  const 六神 = Array.from({ length: 6 }, (_, i) => LIUSHEN[(start + i) % 6]);
  const 空亡 = xunKong(dayGanZhi);

  const 爻 = Array.from({ length: 6 }, (_, i) => ({
    位: i + 1, 值: vals[i], 阴阳: ben[i] ? '阳' : '阴', 动: dong[i],
    六神: 六神[i], 纳甲: 本卦.纳甲[i], 六亲: 本卦.六亲[i],
    空亡: 空亡.includes(本卦.纳甲[i][1]),
    世: 本卦.世爻 === i + 1, 应: 本卦.应爻 === i + 1,
    变: 变卦 ? { 纳甲: 变卦.纳甲[i], 六亲: 变卦.六亲[i], 阴阳: 变卦.爻[i] ? '阳' : '阴' } : null,
  }));

  return { 本卦, 变卦, 爻, 六神, 空亡, 日干支: dayGanZhi, 动爻数: dong.filter(Boolean).length };
}
