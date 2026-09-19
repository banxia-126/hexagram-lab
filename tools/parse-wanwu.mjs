// 从《梅花易數·卷一》的〈八卦萬物屬類〉提取八卦各别的属类，供梅花结果页「取象」用。
// 原文属公有领域。本脚本只做提取与自校验，不改写文本。
//
// 用法：node tools/parse-wanwu.mjs <卷一正文.txt>
// 正文来源：维基文库《梅花易数·卷一》。本地那份是先把该页导出的 PDF 抽文本层：
//   python -c "import fitz;open('juan1.txt','w',encoding='utf-8').write(
//     '\n'.join(p.get_text() for p in fitz.open('梅花易數_卷一.pdf')))"
import { readFileSync, writeFileSync } from 'node:fs';
import { GUA_WX } from '../core/data.js';

const src = readFileSync(process.argv[2] || '/tmp/meihua-juan1.txt', 'utf8');

// 只取〈八卦萬物屬類〉这一节，到下一节〈八卦方位圖〉为止
const S = src.indexOf('八卦萬物屬類');
const E = src.indexOf('八卦方位圖');
if (S < 0 || E <= S) throw new Error('正文里找不到〈八卦萬物屬類〉～〈八卦方位圖〉这一段');
let seg = src.slice(S, E);

// 页码是单独成行的阿拉伯数字，去掉。其余换行**直接接上**：
// 一个属类会被页面截断成两行（「藤」在页尾、「生之物」在次页页首），
// 中间插了换行就拼不回「藤生之物」了。
seg = seg.split(/\r?\n/).filter((l) => !/^\s*\d+\s*$/.test(l)).join('');

// 每个卦块以「卦名：」开头，其余地方不用冒号，可以放心按它切
const 卦名 = [...seg.matchAll(/([乾兌離震巽坎艮坤])[：:]/g)];
if (!卦名.length) throw new Error('一个卦块都没切出来，正文版式可能变了');

// 卦名繁→简（只换卦名这两个字，属类一律保持原文繁体）
const T2S = { 兌: '兑', 離: '离' };
const out = {};
const 问题 = [];
for (const [i, m] of 卦名.entries()) {
  const g = T2S[m[1]] || m[1];
  const body = seg.slice(m.index + 2, 卦名[i + 1]?.index ?? seg.length);
  // 属类之间用顿号，句末用句号（艮那一块中间还夹了个「。黃色。」），两种都当分隔符
  const list = body.split(/[、。]/).map((s) => s.replace(/[\s　]+/g, '')).filter(Boolean);
  if (out[g]) 问题.push(`${g} 出现了两次`);
  out[g] = list;
}

// ── 自校验：数量与脏字一起卡住，防止切错位置还静默产出 ──
const 八卦 = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const 缺 = 八卦.filter((g) => !out[g]);
if (缺.length) 问题.push(`缺卦：${缺.join('、')}`);
for (const [g, list] of Object.entries(out)) {
  if (list.length < 10) 问题.push(`${g} 只解出 ${list.length} 条，疑似串行`);
  if (list.some((v) => /[：:、。0-9（）()]/.test(v))) 问题.push(`${g} 有没洗净的：${list.filter((v) => /[：:、。0-9（）()]/.test(v)).join('、')}`);
  const 重 = [...new Set(list.filter((v, i) => list.indexOf(v) !== i))];
  if (重.length) 问题.push(`${g} 有重复：${重.join('、')}`);
}
if (问题.length) {
  console.error('✗ ' + 问题.join('\n✗ '));
  process.exit(1);
}

writeFileSync(new URL('../core/gen/wanwu.js', import.meta.url),
  `// 自动生成，请勿手改 —— 由 tools/parse-wanwu.mjs 从维基文库\n`
  + `// 《梅花易數·卷一》〈八卦萬物屬類〉提取。原文属公有领域，\n`
  + `// 卦名用简体（兑/离），属类保持繁体原貌未作转换。\n`
  + `export const WANWU = {\n`
  + 八卦.map((g) => `  ${g}: [${out[g].map((v) => JSON.stringify(v)).join(', ')}],`).join('\n')
  + `\n};\n`, 'utf8');

const 总数 = Object.values(out).reduce((a, v) => a + v.length, 0);
console.log(`提取 ${Object.keys(out).length} / 8 卦　属类共 ${总数} 条`);
for (const g of 八卦) console.log(`  ${g}（${GUA_WX[g]}）${out[g].length} 条：${out[g].join(' ')}`);
