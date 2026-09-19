// 梅花易数：三种起卦法
//
// 《梅花易数·卷一·卦数起例》里所有起卦法的结构完全一样，只有「哪几个数相加」
// 不同，÷8 / ÷6 的映射是共用的：
//   卦以八除……如得八數整，即坤卦，更不必除也
//   爻以六除……取爻當以時加之
//
// 最后那句「取爻當以時加之」就是千年争议的源头 —— 部分版本视其为后加/错简。
// 本工具的处理：**加不加时辰只作用在动爻上**，上卦下卦不受影响。
// 三种算法各自把实际用到的算式原样打到界面上（式 数组）。
import { ORDER, YAO, guaName, GUA_WX } from './data.js';

// 年支数 子=1…亥=12
export const yearZhiNum = (year) => (year - 4) % 12 + 1;

// 卦以八除、爻以六除：余 0 一律作 8（坤）/ 6（上爻）
const modN = (n, base) => {
  const r = ((n % base) + base) % base;
  return r === 0 ? base : r;
};

// ── 原子内核 ──────────────────────────────────────────
// 三种起卦法最后都落到这里：上下卦与动爻都定下来之后，怎么组装成一个卦。
export function assemble(上, 下, 动爻) {
  const 本卦爻 = [...YAO[下], ...YAO[上]];                      // 初→上
  const 互卦爻 = 本卦爻.slice(1, 4).concat(本卦爻.slice(2, 5));   // 二三四 + 三四五
  const 变卦爻 = 本卦爻.map((v, i) => (i === 动爻 - 1 ? v ^ 1 : v));

  const split = (arr) => ({
    下: ORDER.find((g) => YAO[g].join('') === arr.slice(0, 3).join('')),
    上: ORDER.find((g) => YAO[g].join('') === arr.slice(3, 6).join('')),
    爻: arr,
  });
  const B = split(本卦爻), H = split(互卦爻), V = split(变卦爻);

  // 体用：动爻在下卦则下卦为用、上卦为体；反之亦然
  const 动在下 = 动爻 <= 3;

  return {
    本卦: { 名: guaName(B.上, B.下), 上: B.上, 下: B.下, 爻: B.爻 },
    互卦: { 名: guaName(H.上, H.下), 上: H.上, 下: H.下, 爻: H.爻 },
    变卦: { 名: guaName(V.上, V.下), 上: V.上, 下: V.下, 爻: V.爻 },
    动爻,
    体: 动在下 ? B.上 : B.下,
    用: 动在下 ? B.下 : B.上,
  };
}

// 三个和 → 卦（时间起卦与两种数字起卦都走这里）
export const qiguaBySums = (up, lo, mv) =>
  assemble(ORDER[modN(up, 8) - 1], ORDER[modN(lo, 8) - 1], modN(mv, 6));

// 直接指定上下卦与动爻，不经过取余。给「手动选卦」入口和复现路由用。
export const qiguaDirect = (上, 下, 动爻) => assemble(上, 下, 动爻);

// 算式行：把「和 → 余数 → 卦」原样写出来给界面用。label 为空则只写右边的除法。
const line = (label, sum, base, got) =>
  (label ? `${label} ＝ ${sum}　→　` : `${sum}　→　`)
  + `${sum} ÷ ${base} 余 ${modN(sum, base)}　${got}`;

// ── 一、时间起卦（年月日时起例）──────────────────────
// 年支 + 月 + 日 取上卦；再加时辰取下卦与动爻。
export function qigua(year, month, day, hourZhi) {
  const y = yearZhiNum(year);
  const s1 = y + month + day, s2 = s1 + hourZhi;
  const r = qiguaBySums(s1, s2, s2);
  return {
    ...r,
    法: '时间起卦',
    参数: { 年支: y, 月: month, 日: day, 时辰: hourZhi },
    式: [
      line(`年支 ${y} ＋ 月 ${month} ＋ 日 ${day}`, s1, 8, `上卦 ${r.本卦.上}`),
      line(`${s1} ＋ 时 ${hourZhi}`, s2, 8, `下卦 ${r.本卦.下}`),
      line('', s2, 6, `动爻 第 ${r.动爻} 爻`),
    ],
  };
}

// ── 二、方法1：一串数字从中间劈开，两段各自「各位相加」 ──
// 先把整串从中间劈成两段（**前段位数 ≤ 后段位数**，奇数位时前段短一位），
// 再把每段的**各位数字加起来**得到一个数 —— 不是把两段当成两个整数：
//   12345 → 12 / 345 → 1+2 = 3、3+4+5 = 12 → 上卦取 3、下卦取 12
// 前段会是空串的情况（只报了一位数）劈不开，返回 null 由界面提示。
export const splitDigits = (s) => {
  const k = Math.floor(s.length / 2);
  if (k < 1) return null;
  const 前段 = s.slice(0, k), 后段 = s.slice(k);
  const 各位和 = (t) => [...t].reduce((a, c) => a + Number(c), 0);
  return { 前段, 后段, 前: 各位和(前段), 后: 各位和(后段) };
};

// 「12 → 1+2 ＝ 3」这样把加法也写出来，免得用户以为前段直接当 12 用
const sumLine = (段) => [...段].join(' ＋ ');

export function qiguaSplit(digits, hourZhi, addHour) {
  const s = String(digits);
  const p = splitDigits(s);
  if (!p) return null;
  const mv = addHour ? p.前 + p.后 + hourZhi : p.前 + p.后;
  const r = qiguaBySums(p.前, p.后, mv);
  return {
    ...r,
    法: addHour ? '方法1 · 计入时辰' : '方法1 · 不计时辰',
    参数: { 报数: s, 前: p.前, 后: p.后, 时辰: hourZhi },
    式: [
      `${s} 从中间劈作 ${p.前段} 与 ${p.后段}`,
      line(`前段 ${p.前段}：${sumLine(p.前段)}`, p.前, 8, `上卦 ${r.本卦.上}`),
      line(`后段 ${p.后段}：${sumLine(p.后段)}`, p.后, 8, `下卦 ${r.本卦.下}`),
      line(addHour ? `前和 ${p.前} ＋ 后和 ${p.后} ＋ 时 ${hourZhi}` : `前和 ${p.前} ＋ 后和 ${p.后}`,
        mv, 6, `动爻 第 ${r.动爻} 爻`),
    ],
  };
}

// ── 三、方法2：三个数分别指定 ─────────────────────────
// 数一取上卦、数二取下卦、数三取动爻。加时辰只加在动爻上。
export function qiguaThree(a, b, c, hourZhi, addHour) {
  const mv = addHour ? c + hourZhi : c;
  const r = qiguaBySums(a, b, mv);
  return {
    ...r,
    法: addHour ? '方法2 · 计入时辰' : '方法2 · 不计时辰',
    参数: { 数一: a, 数二: b, 数三: c, 时辰: hourZhi },
    式: [
      line(`数一 ${a}`, a, 8, `上卦 ${r.本卦.上}`),
      line(`数二 ${b}`, b, 8, `下卦 ${r.本卦.下}`),
      line(addHour ? `数三 ${c} ＋ 时 ${hourZhi}` : `数三 ${c}`, mv, 6, `动爻 第 ${r.动爻} 爻`),
    ],
  };
}

// ── 体用 ──────────────────────────────────────────────
// 只留「哪一卦是体、哪一卦是用」这个定位，生克断语（体克用→诸事吉那一套）
// 已经拿掉：那套断法把六十四卦压成五个标签，读起来比卦本身还硬。
// 现在结果页改为按体卦、用卦取象（见 core/gen/wanwu.js）。
export const tiYongWuXing = (ti, yong) => ({ 体五行: GUA_WX[ti], 用五行: GUA_WX[yong] });
