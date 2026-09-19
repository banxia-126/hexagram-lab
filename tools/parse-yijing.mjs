// 从 Project Gutenberg 公版《易經》(eBook #25501) 提取 64 卦的
// 卦辞、彖传、大象辞、六爻爻辞、各爻小象。
// 原文属公有领域。本脚本只做提取与自校验，不改写文本。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { ORDER, YAO, guaName } from '../core/data.js';

const src = readFileSync(process.argv[2] || '/tmp/pg25501.txt', 'utf8');
const lines = src.split(/\r?\n/);

// 文王卦序：第 N 卦 = [上卦, 下卦]
const KING_WEN = [
  ['乾','乾'],['坤','坤'],['坎','震'],['艮','坎'],['坎','乾'],['乾','坎'],['坤','坎'],['坎','坤'],
  ['巽','乾'],['乾','兑'],['坤','乾'],['乾','坤'],['乾','离'],['离','乾'],['坤','艮'],['震','坤'],
  ['兑','震'],['艮','巽'],['坤','兑'],['巽','坤'],['离','震'],['艮','离'],['艮','坤'],['坤','震'],
  ['乾','震'],['艮','乾'],['艮','震'],['兑','巽'],['坎','坎'],['离','离'],['兑','艮'],['震','巽'],
  ['乾','艮'],['震','乾'],['离','坤'],['坤','离'],['巽','离'],['离','兑'],['坎','艮'],['震','坎'],
  ['艮','兑'],['巽','震'],['兑','乾'],['乾','巽'],['兑','坤'],['坤','巽'],['兑','坎'],['坎','巽'],
  ['兑','离'],['离','巽'],['震','震'],['艮','艮'],['巽','艮'],['震','兑'],['震','离'],['离','艮'],
  ['巽','巽'],['兑','兑'],['巽','坎'],['坎','兑'],['巽','兑'],['震','艮'],['坎','离'],['离','坎'],
];

// 卦名用字的繁→简（只覆盖卦名，正文保持原文不动）
const T2S = {
  訟:'讼', 師:'师', 謙:'谦', 隨:'随', 蠱:'蛊', 臨:'临', 觀:'观', 賁:'贲', 剝:'剥',
  復:'复', 無:'无', 頤:'颐', 過:'过', 離:'离', 恆:'恒', 遯:'遁', 壯:'壮', 晉:'晋',
  損:'损', 漸:'渐', 歸:'归', 豐:'丰', 兌:'兑', 渙:'涣', 節:'节', 濟:'济', 為:'为',
};
const toSimp = (s) => [...s].map((c) => T2S[c] || c).join('');

const clean = (s) => s.replace(/[\s　]+/g, '');

// 爻题行：初九／六二／九五／上六／用九。文言里的「初九曰：」不匹配（曰 不是 ：）
const YAO_TITLE = /^(初[九六]|[九六][二三四五]|上[九六]|用[九六])：/;

// 「标签行 + 其后的缩进续行」拼成一条。原书续行一律以全角空格起头。
function takeBlock(body, i) {
  let s = clean(body[i]);
  let j = i + 1;
  while (j < body.length && /^[　\s]/.test(body[j])) { s += clean(body[j]); j++; }
  return [s, j];
}

const CN_NUM = ['一','二','三','四','五','六','七','八','九','十'];
const cnNum = (n) => (n <= 10 ? CN_NUM[n - 1]
  : n < 20 ? '十' + CN_NUM[n - 11]
  : n === 20 ? '二十'
  : n < 30 ? '二十' + CN_NUM[n - 21]
  : n === 30 ? '三十'
  : n < 40 ? '三十' + CN_NUM[n - 31]
  : n === 40 ? '四十'
  : n < 50 ? '四十' + CN_NUM[n - 41]
  : n === 50 ? '五十'
  : n < 60 ? '五十' + CN_NUM[n - 51]
  : n === 60 ? '六十' : '六十' + CN_NUM[n - 61]);

// 第 N 卦 在原文里的起头行号。用它当下一个卦的**结束边界**，
// 比原来「往后数 40 行」稳 —— 乾卦光文言就有一百多行。
const START = [];
for (let n = 1; n <= 64; n++) {
  START[n] = lines.findIndex((l) => clean(l) === `第${cnNum(n)}卦`);
}

const out = {};
const problems = [];
const END = /[。！？]$/;

for (let n = 1; n <= 64; n++) {
  if (START[n] < 0) { problems.push(`第${n}卦：找不到「第${n}卦」`); continue; }
  const stop = n < 64 ? START[n + 1] : lines.length;
  const body = lines.slice(START[n] + 1, stop).filter((l) => l.trim());

  // 多数卦「卦名」独占一行；恆卦等少数直接与卦辞连写，需从「：」前切出
  const name = clean(body[0]).split('：')[0];
  const [up, dn] = KING_WEN[n - 1];
  const full = guaName(up, dn);

  // 自校验：文本的短卦名（转简后）必须是我 64 卦全名的子串，否则说明文王卦序排错了
  if (!full.includes(toSimp(name))) problems.push(`第${n}卦：文本作「${name}」，推得「${full}」`);

  // 文言传排在彖、象之后，且只有乾坤两卦有。它里面的「初九曰：」不是爻辞，
  // 但为免它夹带的引文跟爻辞混淆，扫到这里就截断。
  const wen = body.findIndex((l) => clean(l).startsWith('文言曰：'));
  const core = wen >= 0 ? body.slice(0, wen) : body;

  // ── 卦辞：以卦名开头、含「：」的那一行 ──
  const gi = core.findIndex((l) => clean(l).startsWith(name + '：'));
  if (gi < 0) { problems.push(`第${n}卦(${name})：找不到卦辞`); continue; }
  const [卦辞] = takeBlock(core, gi);

  // ── 彖传 ──
  const ci = core.findIndex((l) => clean(l).startsWith('彖曰：'));
  const 彖 = ci >= 0 ? takeBlock(core, ci)[0].slice(3) : '';

  // ── 象辞。两种版式都要吃：
  //   交替式（绝大多数）：每爻下面跟一条「象曰：」
  //   集中式（乾）：爻辞先列完，再一个「象曰：」块，首行大象、其后各爻小象
  // 统一处理：把所有象行的**内容**按出现顺序摊平，第一条是大象，其余依次配各爻。
  const 象行 = [];
  for (let i = 0; i < core.length; i++) {
    if (!clean(core[i]).startsWith('象曰：')) continue;
    象行.push(clean(core[i]).slice(3));
    let j = i + 1;
    while (j < core.length && /^[　\s]/.test(core[j])) { 象行.push(clean(core[j])); j++; }
    i = j - 1;
  }
  const 大象 = 象行[0] || '';
  const 小象 = 象行.slice(1);

  // ── 爻辞 ──
  const 爻行 = [];
  for (let i = 0; i < core.length; i++) {
    if (!YAO_TITLE.test(clean(core[i]))) continue;
    const [s, j] = takeBlock(core, i);
    爻行.push(s); i = j - 1;
  }

  // 自校验之一：条数必须对得上（六爻，乾坤另有 用九/用六）
  const 应爻数 = (full === '乾为天' || full === '坤为地') ? 7 : 6;
  if (爻行.length !== 应爻数) problems.push(`第${n}卦(${full})：爻辞 ${爻行.length} 条，应 ${应爻数} 条`);
  if (小象.length !== 爻行.length) problems.push(`第${n}卦(${full})：小象 ${小象.length} 条，爻辞 ${爻行.length} 条，配不上`);

  // 自校验之二（最硬的一条）：爻题必须与卦画严格对应。
  // 阳爻作 初九/九二…上九，阴爻作 初六/六二…上六 —— 由 core/data.js 的 YAO 推。
  // 对不上就说明卦序排错、或者爻辞串行了。同时验了「卦序」和「爻位」两件事。
  const 阴阳 = [...YAO[dn], ...YAO[up]];          // 初→上
  const 位名 = ['初', '二', '三', '四', '五', '上'];
  const 期望 = 阴阳.map((y, i) =>
    i === 0 ? (y ? '初九' : '初六')
    : i === 5 ? (y ? '上九' : '上六')
    : (y ? '九' : '六') + 位名[i]);
  爻行.slice(0, 6).forEach((s, i) => {
    const t = s.split('：')[0];
    if (t !== 期望[i]) problems.push(`第${n}卦(${full})：第${i + 1}爻作「${t}」，按卦画应作「${期望[i]}」`);
  });

  // 完整性：每条都必须是以句号收尾的完整句子，否则说明还有没拼上的续行
  if (!END.test(卦辞)) problems.push(`第${n}卦(${full})：卦辞疑似截断「${卦辞}」`);
  if (彖 && !END.test(彖)) problems.push(`第${n}卦(${full})：彖疑似截断「${彖}」`);
  if (!END.test(大象)) problems.push(`第${n}卦(${full})：大象疑似截断「${大象}」`);
  小象.forEach((s, i) => {
    if (!END.test(s)) problems.push(`第${n}卦(${full})：第${i + 1}爻小象疑似截断「${s}」`);
  });

  const 爻 = 爻行.map((s, i) => ({
    题: s.split('：')[0], 辞: s.slice(s.indexOf('：') + 1), 象: 小象[i] || '',
  }));

  out[full] = { 序: n, 上: up, 下: dn, 卦辞: 卦辞.slice(卦辞.indexOf('：') + 1), 彖, 大象, 爻 };
}

const missing = [];
for (const up of ORDER) for (const dn of ORDER) if (!out[guaName(up, dn)]) missing.push(guaName(up, dn));

// 输出成 ES 模块而不是 JSON：应用侧不用 fetch，离线可用，也便于移植 HML
mkdirSync(new URL('../core/gen/', import.meta.url), { recursive: true });
const body = Object.entries(out).map(([k, v]) =>
  `  ${JSON.stringify(k)}: { 序: ${v.序}, 上: ${JSON.stringify(v.上)}, 下: ${JSON.stringify(v.下)},\n`
  + `    卦辞: ${JSON.stringify(v.卦辞)}, 彖: ${JSON.stringify(v.彖)}, 大象: ${JSON.stringify(v.大象)},\n`
  + `    爻: [\n` + v.爻.map((y) =>
      `      { 题: ${JSON.stringify(y.题)}, 辞: ${JSON.stringify(y.辞)}, 象: ${JSON.stringify(y.象)} },`
    ).join('\n') + `\n    ] },`).join('\n');
writeFileSync(new URL('../core/gen/yijing.js', import.meta.url),
  `// 自动生成，请勿手改 —— 由 tools/parse-yijing.mjs 从 Project Gutenberg\n`
  + `// 公版《易經》(eBook #25501) 提取。原文属公有领域，保持繁体原貌未作转换。\n`
  + `export const YIJING = {\n${body}\n};\n`, 'utf8');

const 爻总 = Object.values(out).reduce((a, v) => a + v.爻.length, 0);
const 有象 = Object.values(out).reduce((a, v) => a + v.爻.filter((y) => y.象).length, 0);
const 有彖 = Object.values(out).filter((v) => v.彖).length;
console.log(`提取 ${Object.keys(out).length} / 64 卦　爻辞 ${爻总} 条　小象 ${有象} 条　彖 ${有彖} 条`);
console.log(`未覆盖: ${missing.length ? missing.join('、') : '无'}`);
console.log(`存疑: ${problems.length ? '\n  ' + problems.join('\n  ') : '无'}`);

console.log('\n抽样：');
for (const k of ['乾为天', '坤为地', '水雷屯', '天泽履', '火水未济']) {
  const g = out[k];
  if (!g) { console.log(` ${k} 缺失`); continue; }
  console.log(`\n ${k} [${g.序}] ${g.卦辞}`);
  console.log(`   彖曰：${(g.彖 || '').slice(0, 30)}…`);
  console.log(`   象曰：${g.大象}`);
  g.爻.forEach((y) => console.log(`   ${y.题}：${y.辞}\n      象曰：${y.象}`));
}
