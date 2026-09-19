import { paipan, tossLine, DAYAN_P } from './core/liuyao.js';
import { qike, GONG, WUXING } from './core/liuren.js';
import {
  qigua, qiguaSplit, qiguaThree, qiguaDirect, splitDigits, tiYongWuXing,
} from './core/meihua.js';
import { eot, lonOffset, solarNow, solarCorrection, lateZiDay } from './core/time.js';
import { parseLon, CITIES } from './core/cities.js';
import { DEFAULTS, load } from './core/settings.js';
import { ORDER, YAO, guaName, GAN, ZHI, shiGanZhi } from './core/data.js';
import { WANWU } from './core/gen/wanwu.js';
import { createRequire } from 'module';
const { Solar } = createRequire(import.meta.url)('./core/vendor/lunar.js');

const V = (s) => s.split('').map(c => c === '1' ? 7 : 8);   // 阴阳→少阳/少阴
const day = '乙未';
const modN = (n, b) => { const r = ((n % b) + b) % b; return r === 0 ? b : r; };
let bad = 0;
const chk = (label, cond, detail = '') => {
  if (!cond) bad++;
  console.log(' ', cond ? '✅' : '❌', label, detail);
};

// ── 1. 八宫：64卦全覆盖且不重复 ──
const all = new Set();
for (let i = 0; i < 64; i++) {
  const y = [0,1,2,3,4,5].map(b => (i >> b) & 1);
  const r = paipan(y.map(b => b ? 7 : 8), day);
  all.add(r.本卦.卦);
}
console.log('64卦覆盖:', all.size, all.size === 64 ? '✅' : '❌ 有重复/遗漏');

// ── 2. 乾宫八卦校验（京房标准）──
const ganGong = [
  ['111111','乾为天','本宫',6], ['011111','天风姤','一世',1], ['001111','天山遁','二世',2],
  ['000111','天地否','三世',3], ['000011','风地观','四世',4], ['000001','山地剥','五世',5],
  ['000101','火地晋','游魂',4], ['111101','火天大有','归魂',3],
];
let ok = true;
console.log('\n乾宫校验:');
for (const [y, name, seq, shi] of ganGong) {
  const r = paipan(V(y), day);
  const good = r.本卦.卦 === name && r.本卦.宫 === '乾' && r.本卦.世应序 === seq && r.本卦.世爻 === shi;
  if (!good) ok = false;
  console.log(' ', good ? '✅' : '❌', name, '| 宫:' + r.本卦.宫, '|', r.本卦.世应序, '| 世爻:' + r.本卦.世爻,
              '| 应爻:' + r.本卦.应爻, '|', good ? '' : '期望 ' + name + '/' + seq + '/世' + shi);
}

// ── 3. 装卦明细抽样 ──
console.log('\n装卦明细（乾为天，日', day + '）:');
const r = paipan(V('111111'), day);
for (let i = 5; i >= 0; i--) {
  const y = r.爻[i];
  console.log(' ', y.六神, y.纳甲, y.六亲, y.阴阳, y.世 ? '【世】' : y.应 ? '【应】' : '', y.空亡 ? '(空)' : '');
}
console.log('  旬空:', r.空亡.join(''));

// ── 4. 小六壬：真实农历跑分布 ──
const cnt = {}; GONG.forEach(g => cnt[g] = 0); let n = 0;
for (let t = Date.UTC(2000,0,1); t < Date.UTC(2100,0,1); t += 86400000) {
  const d = new Date(t), l = Solar.fromYmd(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate()).getLunar();
  for (let h = 1; h <= 12; h++) { cnt[qike(Math.abs(l.getMonth()), l.getDay(), h).宫]++; n++; }
}
console.log('\n小六壬分布 (n=' + n + '):');
GONG.forEach(g => console.log(' ', g, (cnt[g]/n*100).toFixed(3) + '%'));
console.log('  极差:', ((Math.max.apply(null,Object.values(cnt)) - Math.min.apply(null,Object.values(cnt)))/n*100).toFixed(3) + 'pp');

// ── 5. 梅花 ──
console.log('\n梅花抽样 (2026-09-18 午时):');
const m = qigua(2026, 8, 8, 7);
console.log('  本卦:', m.本卦.名, '| 互卦:', m.互卦.名, '| 变卦:', m.变卦.名, '| 动爻:', m.动爻, '| 体:', m.体, '用:', m.用);
const cnt2 = {}; let n2 = 0;
for (let t = Date.UTC(2000,0,1); t < Date.UTC(2100,0,1); t += 86400000) {
  const d = new Date(t), l = Solar.fromYmd(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate()).getLunar();
  for (let h = 1; h <= 12; h++) { const k = qigua(d.getUTCFullYear(), Math.abs(l.getMonth()), l.getDay(), h).本卦.名; cnt2[k] = (cnt2[k]||0)+1; n2++; }
}
const vs = Object.values(cnt2).sort((a,b)=>a-b);
console.log('  梅花卦组合数:', Object.keys(cnt2).length, '| 最少', (vs[0]/n2*100).toFixed(2)+'%', '| 最多', (vs[vs.length-1]/n2*100).toFixed(2)+'%', '| 倍数', (vs[vs.length-1]/vs[0]).toFixed(2)+'x');

// ── 6. 起卦法：屏上算式必须与结果同源 ──
// 式 行格式（见 core/meihua.js 的 line()）：`标签 ＝ 和　→　和 ÷ 基数 余 余数　结果`，标签可省
const parse式 = (l) => {
  const t = l.includes('→') ? l.slice(l.indexOf('→') + 1) : l;
  const g = t.match(/^\s*(\d+)\s*÷\s*(\d+)\s*余\s*(\d+)\s+(.+?)\s*$/);
  return g ? { 和: +g[1], 基: +g[2], 余: +g[3], 果: g[4] } : null;
};

console.log('\n起卦法:');
const 查起卦 = (label, m, wantSums) => {
  // 允许式里夹说明行（方法1 的「12345 从中间劈作 12 与 345」），只挑能解析成算式的
  const ps = m.式.map(parse式).filter(Boolean);
  const 三行 = ps.length === 3;
  const 和基 = 三行 && ps.every((x, i) => x.和 === wantSums[i] && x.基 === (i < 2 ? 8 : 6));
  const 余 = 和基 && ps.every((x) => x.余 === modN(x.和, x.基));
  const 果 = 余 && ps[0].果 === `上卦 ${m.本卦.上}`
    && ps[1].果 === `下卦 ${m.本卦.下}` && ps[2].果 === `动爻 第 ${m.动爻} 爻`;
  chk(`${label}　式与结果一致`, 三行 && 和基 && 余 && 果,
    `和 ${wantSums.join(' ')} → ${m.本卦.名} · 第 ${m.动爻} 爻` + (三行 && 和基 && 余 && 果 ? '' : ` ❗${m.式.join(' | ')}`));
};
// 2026 = 丙午年，年支 午 = 7
查起卦('时间起卦', qigua(2026, 8, 8, 7), [7 + 8 + 8, 7 + 8 + 8 + 7, 7 + 8 + 8 + 7]);
查起卦('方法1·加时', qiguaSplit('12345', 7, true), [3, 12, 3 + 12 + 7]);
查起卦('方法1·不加时', qiguaSplit('12345', 7, false), [3, 12, 3 + 12]);
查起卦('方法2·加时', qiguaThree(12, 25, 9, 7, true), [12, 25, 9 + 7]);
查起卦('方法2·不加时', qiguaThree(12, 25, 9, 7, false), [12, 25, 9]);

// 方法1：先从中间劈成两段（前段位数 **不多于** 后段，奇数位时前段短一位），
// 再把**每段各位数字相加**得到取卦用的数 —— 不是把两段当成两个整数。
// 12345 → 12 / 345 → 1+2＝3、3+4+5＝12。这一条最容易做错，单独钉死。
console.log('\n方法1 劈数 + 各位相加:');
[['12345', '12', '345', 3, 12], ['1234', '12', '34', 3, 7], ['12', '1', '2', 1, 2],
 ['123456789012', '123456', '789012', 21, 27], ['1', null], ['', null]]
  .forEach(([s, q, h, a, b]) => {
    const r = splitDigits(s);
    chk(`"${s}" → ${q === null ? '劈不开，不出卦' : `${q} / ${h} → ${a} / ${b}`}`,
      q === null ? r === null : !!r && r.前段 === q && r.后段 === h && r.前 === a && r.后 === b,
      r ? `${r.前段}(${r.前}) / ${r.后段}(${r.后})` : '不出卦');
  });
chk('一位数不出卦，qiguaSplit 返回 null', qiguaSplit('7', 7, true) === null);

// 各位和才是取卦的除数，两段本身不是。
// '24680' 五位劈作 24 与 680 → 各位和 6 与 14。
const sp = qiguaSplit('24680', 7, false);
chk('方法1 上卦 = 前段各位和 ÷ 8、下卦 = 后段各位和 ÷ 8',
  ORDER[modN(6, 8) - 1] === sp.本卦.上 && ORDER[modN(14, 8) - 1] === sp.本卦.下,
  `24→6 / 680→14 → ${sp.本卦.名}`);
chk('方法1 若把两段当成整数就会算成另一个卦（回归：这正是改之前那个错）',
  ORDER[modN(24, 8) - 1] !== sp.本卦.上, `24÷8 得上卦 ${ORDER[modN(24, 8) - 1]}，实际取的是 ${sp.本卦.上}`);
chk('方法1 屏上算式把「各位相加」写了出来',
  /前段 24：2 ＋ 4 ＝ 6/.test(sp.式.join(' ')) && /后段 680：6 ＋ 8 ＋ 0 ＝ 14/.test(sp.式.join(' ')),
  sp.式[1]);

// 「计时辰」只作用在动爻上。方法1 与方法2 的上下卦完全不吃时辰；
// 时间起卦是另一回事 —— 它的下卦按原文本就该加时辰（年支＋月＋日＋时），
// 所以只断言它的上卦不动。
{
  const base = qigua(2026, 8, 8, 1);
  chk('时间起卦　上卦不随时辰变（下卦原文即加时辰，故会变）',
    [2, 3, 5, 8, 11, 12].every((h) => qigua(2026, 8, 8, h).本卦.上 === base.本卦.上),
    `十二时辰上卦恒 ${base.本卦.上}`);
}
for (const [label, f] of [
  ['方法1', (h) => qiguaSplit('12345', h, true)],
  ['方法2', (h) => qiguaThree(12, 25, 9, h, true)],
]) {
  const base = f(1);
  const 同 = [2, 3, 5, 8, 11, 12].every((h) => {
    const m = f(h);
    return m.本卦.上 === base.本卦.上 && m.本卦.下 === base.本卦.下;
  });
  chk(`${label}　上下卦不随时辰变`, 同, `十二时辰上卦恒 ${base.本卦.上}、下卦恒 ${base.本卦.下}`);
}
// 方法2：数一管上卦、数二管下卦、数三管动爻 —— 各司其职，互不串门。
// 换的数不能与原来的同余（12 与 20 对 8 同余、9 与 3 对 6 同余），否则改了等于没改。
const k1 = qiguaThree(12, 25, 9, 7, false), k2 = qiguaThree(14, 25, 9, 7, false), k3 = qiguaThree(12, 25, 11, 7, false);
chk('方法2 改数一 → 只动上卦', k1.本卦.下 === k2.本卦.下 && k1.动爻 === k2.动爻 && k1.本卦.上 !== k2.本卦.上,
  `${k1.本卦.名} → ${k2.本卦.名}`);
chk('方法2 改数三 → 只动动爻', k1.本卦.名 === k3.本卦.名 && k1.动爻 !== k3.动爻,
  `第 ${k1.动爻} 爻 → 第 ${k3.动爻} 爻`);
// 不计时辰时，时辰怎么变结果都不动
chk('方法2·不计时辰 → 结果与时辰无关',
  [1, 6, 12].every((h) => qiguaThree(12, 25, 9, h, false).本卦.名 === k1.本卦.名
    && qiguaThree(12, 25, 9, h, false).动爻 === k1.动爻));

// ── 7. 选卦（手动指定）──
console.log('\n选卦:');
const d1 = qiguaDirect('坎', '震', 3), d2 = qigua(2026, 8, 8, 7);
chk('直接指定上下卦与动爻 → 卦名对得上', d1.本卦.名 === '水雷屯' && d1.动爻 === 3, d1.本卦.名);
chk('与同一组上下卦的时间起卦结果一致',
  qiguaDirect('艮', '坎', d2.动爻).本卦.名 === d2.本卦.名, d2.本卦.名);
// 动爻在下卦 → 上卦为体；在上卦 → 下卦为体
chk('动爻 1–3 → 体为上卦', [1, 2, 3].every((i) => qiguaDirect('坎', '震', i).体 === '坎'));
chk('动爻 4–6 → 体为下卦', [4, 5, 6].every((i) => qiguaDirect('坎', '震', i).体 === '震'));
// 64 卦全都排得出来，且互卦变卦都不缺；体、用各有五行（取象要靠这个定位）。
// 生克断语已按用户要求删除，所以这里不再断言「关系」。
const 全卦 = new Set();
let 缺 = 0;
for (const u of ORDER) for (const l of ORDER) {
  const m = qiguaDirect(u, l, 1);
  全卦.add(m.本卦.名);
  const wx = tiYongWuXing(m.体, m.用);
  if (!m.互卦.名 || !m.变卦.名 || !wx.体五行 || !wx.用五行) 缺++;
}
chk('64 卦全部排得出，互卦/变卦/体用五行都不缺', 全卦.size === 64 && 缺 === 0,
  `${全卦.size} 卦`);
chk('体用五行查得到（乾金、坤土、坎水、离火、震木）',
  tiYongWuXing('乾', '坤').体五行 === '金' && tiYongWuXing('乾', '坤').用五行 === '土'
  && tiYongWuXing('坎', '离').用五行 === '火' && tiYongWuXing('震', '巽').体五行 === '木',
  '乾金 坤土 坎水 离火 震木');

// ── 8. 真太阳时 ──
console.log('\n真太阳时:');
const near = (a, b, t = 0.01) => Math.abs(a - b) < t;
const D = new Date(Date.UTC(2026, 6, 26, 4, 0));   // 2026-07-26
[[Date.UTC(2026, 1, 11), -14.2], [Date.UTC(2026, 4, 14), 3.7],
 [Date.UTC(2026, 6, 26), -6.5], [Date.UTC(2026, 10, 3), 16.4]]
  .forEach(([ms, want]) => {
    const v = eot(new Date(ms));
    chk(`均时差 ${new Date(ms).toISOString().slice(0, 10)}`, Math.abs(v - want) <= 1.0,
      `${v.toFixed(1)} 分（公认 ${want}）`);
  });
[['北京', 116.41, -14.36], ['西安', 108.93, -44.28], ['拉萨', 91.13, -115.48], ['乌鲁木齐', 87.62, -129.52]]
  .forEach(([n, lon, want]) => chk(`经度修正 ${n}`, near(lonOffset(lon), want), `${lonOffset(lon).toFixed(2)} 分`));

const sOn = { trueSolar: true, lon: 87.62, extraMin: 0 };
const sOff = { trueSolar: false, lon: 87.62, extraMin: 0 };
const cOn = solarCorrection(D, sOn);
chk('关掉真太阳时 → 不修经度与均时差', solarCorrection(D, sOff) === 0);
chk('开着时 = 经度修正 + 均时差', near(cOn, lonOffset(87.62) + eot(D)), `${cOn.toFixed(2)} 分`);
chk('额外时差可叠加', near(solarCorrection(D, { ...sOn, extraMin: -60 }), cOn - 60));
// 回归：早先漏了时区项，真太阳时一关就读到 UTC，东八区整体差 8 小时、跨零点还算错农历日。
const t0 = solarNow(D, { trueSolar: false, lon: 120, extraMin: 0 });
const hhmm = (d) => String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
chk('关掉真太阳时 → 退回本地墙钟（不是 UTC）',
  t0.getUTCHours() === D.getHours() && t0.getUTCMinutes() === D.getMinutes(),
  `换算 ${hhmm(t0)} / 本地 ${String(D.getHours()).padStart(2, '0')}:${String(D.getMinutes()).padStart(2, '0')}`);
const t1 = solarNow(D, { trueSolar: true, lon: 87.62, extraMin: 0 });
const t2 = solarNow(D, { trueSolar: true, lon: 120, extraMin: 0 });
chk('两地之差 = 经度差 × 4 分', near((t2 - t1) / 60000, lonOffset(120) - lonOffset(87.62)),
  `${((t2 - t1) / 60000).toFixed(2)} 分`);

const 夜 = new Date(Date.UTC(2026, 8, 18, 23, 30)), 亥 = new Date(Date.UTC(2026, 8, 18, 22, 30));
chk('晚子时·子时换日 → 挪到次日', lateZiDay(夜, 'roll').getUTCDate() === 19);
chk('晚子时·夜子时 → 日期不动', lateZiDay(夜, 'keep').getUTCDate() === 18);
chk('非子时不挪', lateZiDay(亥, 'roll').getUTCDate() === 18);

// ── 9. 筮法抽样 ──
console.log('\n筮法抽样 (各 20 万次):');
const N = 200000;
for (const [name, method, want] of [['三钱法', 'coin', { 6: 1/8, 7: 3/8, 8: 3/8, 9: 1/8 }],
                                     ['大衍筮法', 'dayan', DAYAN_P]]) {
  const c = { 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let i = 0; i < N; i++) c[tossLine(method)]++;
  const dev = Math.max(...[6, 7, 8, 9].map((v) => Math.abs(c[v] / N - want[v])));
  chk(`${name} 单爻分布`, dev < 0.005, [6, 7, 8, 9].map((v) => `${v}:${(c[v]/N*100).toFixed(2)}%`).join(' '));
  chk(`${name} 老阳:老阴 = ${method === 'dayan' ? '3' : '1'}:1`,
    near(c[9] / c[6], method === 'dayan' ? 3 : 1, 0.1), (c[9] / c[6]).toFixed(3));
}

// ── 10. 两套六宫五行 ──
console.log('\n六宫五行:');
const 异 = GONG.filter((g) => WUXING.shen[g] !== WUXING.liu[g]);
chk('两套只在留连/小吉上不同', 异.join() === '留连,小吉', 异.join('/') || '(无)');
chk('六神本：留连水 · 小吉木', WUXING.shen.留连 === '水' && WUXING.shen.小吉 === '木');
chk('流传本：留连土 · 小吉水', WUXING.liu.留连 === '土' && WUXING.liu.小吉 === '水');
let 留连 = [1, 1, 1];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let h = 1; h <= 12; h++) {
  if (qike(a, b, h, 'shen').宫 === '留连') { 留连 = [a, b, h]; a = b = h = 99; }
}
const w1 = qike(...留连, 'shen'), w2 = qike(...留连, 'liu');
chk('方位与色跟着五行走（不会五行土配北方）',
  w1.五行 === '水' && w1.方位 === '北' && w1.色 === '黑'
  && w2.五行 === '土' && w2.方位 === '中' && w2.色 === '黄',
  `${留连.join('/')} → ${w1.五行}${w1.方位}${w1.色} vs ${w2.五行}${w2.方位}${w2.色}`);
chk('断辞不随五行变', w1.断 === w2.断 && w1.宫 === w2.宫, `${w1.宫} · ${w1.断}`);
chk('未知派别名 → 回落六神本', qike(...留连, 'nope').五行 === '水');

// ── 11. 经度输入与设置回落 ──
console.log('\n经度与设置:');
chk('城市表完整', CITIES.length >= 34 && new Set(CITIES.map((c) => c[0])).size === CITIES.length
  && CITIES.every(([, v]) => v > 70 && v < 140), `${CITIES.length} 条`);
[['120', 120], ['116.41', 116.41], [' 87.62 ', 87.62], ['-73.5', -73.5]]
  .forEach(([s, w]) => chk(`parseLon "${s}"`, parseLon(s) === w));
[['abc', null], ['', null], ['999', null], ['-200', null]]
  .forEach(([s, w]) => chk(`parseLon 拒绝 "${s}"`, parseLon(s) === w));
// node 里没有 window，load() 必须静默回落默认值而不是抛异常（隐私模式同此路径）
const d = load();
chk('无浏览器存储时回落默认值', d.lateZi === DEFAULTS.lateZi && d.lon === 120 && d.trueSolar === true);
chk('默认取主流写法', DEFAULTS.mhMethod === 'time' && DEFAULTS.mhAddHour === true
  && DEFAULTS.lyMethod === 'coin' && DEFAULTS.lrWuxing === 'shen');

// ── 12. 五鼠遁（时柱）──
// 硬写那张十干表，不拿函数算自己：甲己还加甲、乙庚丙作初、丙辛从戊起、
// 丁壬庚子居、戊癸何方发、壬子是真途。
console.log('\n五鼠遁（时柱）:');
const ZISHI = ['甲子', '丙子', '戊子', '庚子', '壬子'];   // 甲/乙/丙/丁/戊 日子时
[[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 0], [6, 1], [7, 2], [8, 3], [9, 4]]
  .forEach(([g, want]) => {
    const 日干支 = GAN[g] + '子';
    chk(`${GAN[g]}日子时`, shiGanZhi(日干支, 1) === ZISHI[want], `${shiGanZhi(日干支, 1)}（应为 ${ZISHI[want]}）`);
  });

// 同一日柱走完十二时辰，时支必须子→亥各一次
const 全 = Array.from({ length: 12 }, (_, i) => shiGanZhi('乙未', i + 1));
chk('十二时辰时支各一次', new Set(全.map((s) => s[1])).size === 12 && 全[0][1] === '子' && 全[11][1] === '亥',
  全.join(' '));
// 十二时辰走下来时干逐位 +1 而模 10，所以是 10 个干各一次、其中 2 个重复
chk('时干十个各出现一次（共十二位）',
  new Set(全.map((s) => s[0])).size === 10, [...new Set(全.map((s) => s[0]))].join(''));

// 日干进一位 → 时干进两位、时支不动。注意这**不是**六十甲子里进两位：
// 干进二、支不动，合起来在六十甲子里是进 12（12 mod 10 = 2，12 mod 12 = 0）。
const JIAZI = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);
const 序 = (gz) => JIAZI.indexOf(gz);
const 干进二 = JIAZI.slice(0, 10).every((d, i) => {
  const a = shiGanZhi(d, 5), b = shiGanZhi(JIAZI[(序(d) + 1) % 60], 5);
  return GAN.indexOf(b[0]) === (GAN.indexOf(a[0]) + 2) % 10 && b[1] === a[1];
});
chk('日柱进一位 → 时干进两位、时支不动', 干进二, '取辰时（5）逐日验');
chk('折算到六十甲子是进 12',
  JIAZI.slice(0, 10).every((d) => 序(shiGanZhi(JIAZI[(序(d) + 1) % 60], 5)) === (序(shiGanZhi(d, 5)) + 12) % 60));
chk('时柱必是合法六十甲子干支',
  全.every((s) => 序(s) >= 0), 全.join(' '));

// ── 13. 取象：〈八卦萬物屬類〉──
// core/gen/wanwu.js 是从《梅花易數·卷一》解析出来的。解析脚本里已有自校验，
// 这里再卡一道：有人手改 gen 文件、或换个版式的源重新生成时静默错位，
// 表现就是某卦少几条、或者串到隔壁卦去 —— 那种错肉眼扫一遍是看不出来的。
const 八卦名 = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
chk('八卦齐全、无多余键', 八卦名.every((g) => WANWU[g]) && Object.keys(WANWU).length === 8);
chk('每卦至少 10 条属类', 八卦名.every((g) => WANWU[g].length >= 10),
  八卦名.map((g) => `${g}${WANWU[g].length}`).join(' '));
chk('卦内无重复、无空条、无残标点',
  八卦名.every((g) => new Set(WANWU[g]).size === WANWU[g].length
    && WANWU[g].every((v) => v && !/[、。：:0-9（）()]/.test(v))));
// 抽最容易出问题的两头：兑那列最短（13），坎那列最长（25）
chk('兑 13 条、以「婢」收尾', WANWU.兑.length === 13 && WANWU.兑.at(-1) === '婢');
chk('坎 25 条、以「黑色」收尾', WANWU.坎.length === 25 && WANWU.坎.at(-1) === '黑色');
// 跨页断开的那一条：「藤」在页尾、「生之物」在次页页首，拼不回就是两条残条
chk('艮含跨页拼回的「藤生之物」', WANWU.艮.includes('藤生之物'));

console.log('\n' + (ok && all.size === 64 && bad === 0 ? '✅ 全部通过' : `❌ 有问题（${bad} 项）`));
