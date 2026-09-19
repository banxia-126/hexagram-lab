// 术数排演 · 桌面演示（第二版目标：华为 WATCH FIT 4 Lite Wearable）
// 只用 HTML/CSS/JS，不碰 fetch / ServiceWorker；localStorage 只出现在 core/settings.js。
import { tossLine, tossCoins, coinsToLine, paipan } from './core/liuyao.js';
import { qike } from './core/liuren.js';
import {
  qigua, qiguaSplit, qiguaThree, qiguaDirect, splitDigits, tiYongWuXing,
} from './core/meihua.js';
import { ORDER, SYM, ZHI, GAN_WX, ZHI_WX, hourToZhi, shiGanZhi } from './core/data.js';
import { YIJING } from './core/gen/yijing.js';
import { WANWU } from './core/gen/wanwu.js';
import { load, save, DEFAULTS } from './core/settings.js';
import { solarNow, solarCorrection, minutesToBoundary, lonOffset, lateZiDay } from './core/time.js';
import { CITIES, parseLon, lonLabel } from './core/cities.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 干支按五行上色：干查 GAN_WX、支查 ZHI_WX。**两个字各上各的色** ——
// 纳甲里「甲子」的甲属木、子属水，本来就不同行；六亲正是由支那一半的五行推出来的。
// 干与支的字集不相交，所以一个查不到就查另一个，不会有歧义。
const wxGZ = (gz) => [...String(gz)].map((c) => {
  const w = GAN_WX[c] || ZHI_WX[c];
  return w ? `<span class="wx-${w}">${c}</span>` : c;
}).join('');

// 全部流派分歧都收在这一个对象里，默认值见 core/settings.js
let S = load();
const SAVE = () => save(S);

// ── 时间 ──────────────────────────────────────────────
// 顺序很重要：先按真太阳时把"此刻"挪成当地太阳墙钟时刻，再由这一个时刻
// 推出农历、干支、时辰。因为是从 UTC 起算的，夏令时/冬令时天然就是对的。
function nowInfo() {
  const now = new Date();
  const t = solarNow(now, S);
  const shift = Math.round(solarCorrection(now, S));   // 只报真太阳时那部分，时区不报

  // 晚子时：23:00 起已属次日子时，两派分歧就在要不要把日子一起挪过去
  const day = lateZiDay(t, S.lateZi);
  const 晚子 = day === t && t.getUTCHours() >= 23;

  const l = window.Solar.fromYmd(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()).getLunar();
  const hz = hourToZhi(t.getUTCHours());
  const hh = String(t.getUTCHours()).padStart(2, '0'), mm = String(t.getUTCMinutes()).padStart(2, '0');
  const 日干支 = l.getDayInGanZhi();
  return {
    l, 年: day.getUTCFullYear(),
    月: Math.abs(l.getMonth()), 日: l.getDay(), 闰: l.getMonth() < 0,
    月名: l.getMonthInChinese(), 日名: l.getDayInChinese(),
    // 四柱。年柱按立春、月柱按节气（都是日期粒度），日柱 00:00 换日，
    // 时柱由**本工具认定的日柱**按五鼠遁推 —— 见 core/data.js 的 shiGanZhi。
    年干支: l.getYearInGanZhiByLiChun(), 月干支: l.getMonthInGanZhi(),
    日干支, 时干支: shiGanZhi(日干支, hz),
    时辰: hz, 时辰名: ZHI[hz - 1], 晚子,
    钟点: `${hh}:${mm}`, 时差: shift,
    近边界: minutesToBoundary(t),
  };
}

// ══ 3D 表体 ══════════════════════════════════════════
const view = { rx: 0, ry: 0 };
const LAYER_N = 16, LAYER_STEP = 1.3;   // 厚度 ≈ 21px

function buildShell() {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const a = hex('#2b2924'), b = hex('#0b0b0a');
  let html = '';
  for (let i = 1; i <= LAYER_N; i++) {
    const t = i / LAYER_N;
    const c = a.map((v, k) => Math.round(v + (b[k] - v) * t));
    html += `<i style="transform:translateZ(${(-i * LAYER_STEP).toFixed(2)}px);`
          + `background:rgb(${c.join(',')})"></i>`;
  }
  html += `<i class="shell-back" style="transform:translateZ(${(-(LAYER_N + 1) * LAYER_STEP).toFixed(2)}px)"></i>`;
  $('layers').innerHTML = html;
}

function applyView() {
  $('watch').style.transform = `rotateX(${view.rx.toFixed(2)}deg) rotateY(${view.ry.toFixed(2)}deg)`;
}

// 拖动表体旋转
let spin = null, suppressClick = false;
$('watch').addEventListener('mousedown', (e) => {
  if (e.target.closest('.crown') || e.target.closest('.notch')) return;
  spin = { x: e.clientX, y: e.clientY, rx0: view.rx, ry0: view.ry, moved: false };
  $('watch').classList.add('dragging');
  e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!spin) return;
  const dx = e.clientX - spin.x, dy = e.clientY - spin.y;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) spin.moved = true;
  view.ry = spin.ry0 + dx * 0.6;
  view.rx = clamp(spin.rx0 - dy * 0.42, -30, 30);
  applyView();
});
window.addEventListener('mouseup', () => {
  if (!spin) return;
  suppressClick = spin.moved;
  $('watch').classList.remove('dragging');
  spin = null;
  if (suppressClick) setTimeout(() => { suppressClick = false; }, 0);
});

// ══ 页面切换 ══════════════════════════════════════════
// 三个板块各自成页：进去之后就是那一个板块，与别处互不影响。
// 表冠只在**本页内**滚动，不跨板块 —— 换板块要先 ‹ 回首页重点。
const PAGE_ORDER = ['home', 'liuyao', 'liuren', 'meihua', 'settings'];
let curPage = 'home';
let mhInput = { nums: [], buf: '' };   // 数字起卦的报数状态
let mhManual = null;                   // 选卦：{ 上, 下, 动爻 }，非空即手动
let lrManual = null;                   // 小六壬手定：{ 月, 日, 时 }，null = 按时

const mhReset = () => { mhInput = { nums: [], buf: '' }; };

// 换板块 = 重开一局。三个板块彼此独立，谁也不欠谁的状态。
function go(name) {
  if (!PAGE_ORDER.includes(name)) return;
  if (curPage === 'liuyao' && name !== 'liuyao') { shakeCancel(); resetLiuyao(); }
  curPage = name;
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelector(`.page[data-page="${name}"]`).classList.add('active');
  if (name === 'home') renderHome();
  if (name === 'liuyao') { resetLiuyao(); renderLiuyaoIdle(); }   // 进来就是一局新的
  if (name === 'liuren') renderLiuren();
  if (name === 'meihua') { mhReset(); renderMeihua(); }
  if (name === 'settings') renderSettings();
  updateNotch();
}

// ══ 表冠：转动滚页（只滚本页，不跨板块）════════════
const NOTCH = 15;   // 每 15px 行程算一格

// 滚到头就停住，不做任何跨页动作 —— 板块之间是彼此独立的。
function step(dir) {
  const b = activeBody();
  if (!b) return;
  const max = b.scrollHeight - b.clientHeight;
  if (max <= 2) return;
  b.scrollTop = clamp(b.scrollTop + dir * 72, 0, max);
  updateNotch();
}

let crown = null, notchTimer = 0;
$('crown').addEventListener('mousedown', (e) => {
  crown = { y: e.clientY, acc: 0 };
  clearTimeout(notchTimer);
  $('notch').classList.add('on');
  e.preventDefault(); e.stopPropagation();
});
window.addEventListener('mousemove', (e) => {
  if (!crown) return;
  crown.acc += e.clientY - crown.y;
  crown.y = e.clientY;
  while (crown.acc >= NOTCH) { crown.acc -= NOTCH; step(1); }
  while (crown.acc <= -NOTCH) { crown.acc += NOTCH; step(-1); }
});
window.addEventListener('mouseup', () => {
  if (!crown) return;
  crown = null;
  notchTimer = setTimeout(() => $('notch').classList.remove('on'), 900);
});

window.addEventListener('wheel', (e) => {
  if (e.target.closest('.sheet') || e.target.closest('.watch')) {
    step(e.deltaY > 0 ? 1 : -1);
    e.preventDefault();
  }
}, { passive: false });

function updateNotch() {
  const b = activeBody();
  const max = b ? b.scrollHeight - b.clientHeight : 0;
  const p = max > 2 ? (b.scrollTop / max) : 1;
  $('notch-fill').style.height = (p * 100).toFixed(1) + '%';
}

// ══ 事件委托 ══════════════════════════════════════════
document.addEventListener('click', (e) => {
  if (suppressClick) return;
  const g = e.target.closest('[data-go]');
  if (g) return go(g.dataset.go);
  if (e.target.closest('[data-act="toss"]')) return shakeTrigger();
  if (e.target.closest('[data-act="close"]')) return openSheet(null);
  if (handleLiuyaoClick(e)) return;
  if (handleLiurenClick(e)) return;
  if (handleMeihuaPick(e)) return;
  const i = e.target.closest('[data-act="info"]');
  if (i) return openSheet(i.dataset.topic);
  if (handleSettingsClick(e)) return;
  if (handleKeypad(e)) return;
  // 点屏幕空白处回正
  if (e.target.closest('.screen') && !$('sheet').classList.contains('open')) {
    view.rx = 0; view.ry = 0; applyView();
  }
});

// ══ 首页 ══════════════════════════════════════════════
function renderHome() {
  const n = nowInfo();
  // 真太阳时可能把时辰整体挪掉一格，压在边界上时明说，免得用户以为算错了
  const near = S.trueSolar && n.近边界 < 10
    ? `<em class="warn">距交下一时辰还有 ${n.近边界} 分钟，此刻起的课随时会翻过去</em>` : '';
  const corr = S.trueSolar && n.时差 !== 0
    ? `　真太阳时 ${n.时差 > 0 ? '+' : '−'}${Math.abs(n.时差)} 分（${S.lonName}）` : '';
  // 四柱：年月日时四根柱子并排，每根**竖着**写 —— 干在上、支在下，底下配小字标签。
  // 干支横着写「丙午」读起来是一个词，竖起来才叫柱，排盘历来也是竖排的。
  const 柱 = [['年', n.年干支], ['月', n.月干支], ['日', n.日干支], ['时', n.时干支]];
  // 日柱单独挂个类：日干是「日主」，一身之主，四柱里就它该重一点（样式见 .rizhu）
  $('now').innerHTML =
    `<div class="sizhu">${柱.map(([k, v]) =>
      `<div${k === '日' ? ' class="rizhu"' : ''}>`
      + [...v].map((c) => `<b>${wxGZ(c)}</b>`).join('')   // 干、支各占一行
      + `<span>${k}</span></div>`).join('')}</div>`
    + `<span class="now-sub">农历${n.闰 ? '闰' : ''}${n.月名}月${n.日名}`
    + ` · ${n.晚子 ? '晚子时' : n.时辰名 + '时'} · ${n.钟点}`
    + corr + `</span>`
    + near;
}

// ══ 设置 ══════════════════════════════════════════════
// 一处分歧一个开关，默认取主流写法。每项底下那行小字说明它改变了什么、属哪一派。
// 布尔键存的是 true/false，其余键存的就是选项值本身。比之前先归一化 ——
// 否则 String(true) 得到 'true'，永远配不上 data-val 的 '1'，开关就永远不亮，
// 看着像点不动（值其实改了，只是界面从不反馈）。
const segVal = (v) => (typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
const seg = (key, opts) => `<div class="seg">`
  + opts.map(([v, t]) => `<button data-set="${key}" data-val="${v}"`
      + `${segVal(S[key]) === v ? ' class="on"' : ''}>${t}</button>`).join('')
  + '</div>';

// 这两项存的是布尔，其余存字符串
const BOOLKEYS = ['trueSolar', 'mhAddHour'];

const cityListHTML = () => CITIES.map(([n, lon]) =>
  `<button class="city${Math.abs(lon - S.lon) < 0.005 ? ' on' : ''}"`
  + ` data-act="pickcity" data-lon="${lon}" data-name="${n}">`
  + `<span>${n}</span><span class="city-v">${lonLabel(lon)}</span></button>`).join('');

// 重画要保住滚动位置，否则点下面那几项会被弹回页首
function renderSettings() {
  const b = $('settings-body');
  const keep = b.scrollTop;
  // 单数/两数起卦才用得上"计时辰"，时间起卦本来就吃时辰
  const 数字 = S.mhMethod !== 'time';
  b.innerHTML = `
    <div class="set-g">时间</div>

    <div class="srow">
      <div class="srow-t">晚子时<span class="srow-n">23:00–24:00 怎么算</span></div>
      ${seg('lateZi', [['roll', '子时换日'], ['keep', '夜子时']])}
      <div class="srow-d">换日：一过 23 点，农历日与日干支都算次日（主流排盘软件）。夜子时：日子不动，只把时辰标成晚子时。</div>
    </div>

    <div class="srow">
      <div class="srow-t">真太阳时</div>
      ${seg('trueSolar', [['1', '开'], ['0', '关']])}
      <div class="srow-d">按当地经度把钟表时间校正到太阳过当地子午线的时刻。西安差 −44 分、乌鲁木齐 −130 分，足以整体挪掉一个时辰。夏令时/冬令时不必另设开关：本工具一律从 UTC 起算，DST 天然已经含在内。</div>
    </div>

    <div class="srow">
      <div class="srow-t">经度</div>
      <button class="pick" data-act="city">
        <span>${S.lonName}</span>
        <span class="pick-v">经度修正 ${lonOffset(S.lon) >= 0 ? '+' : '−'}${Math.abs(lonOffset(S.lon)).toFixed(0)} 分　›</span>
      </button>
    </div>

    <div class="srow">
      <div class="srow-t">额外时差</div>
      <div class="step">
        <button data-act="exmin" data-d="-5">−</button>
        <span class="step-v">${S.extraMin > 0 ? '+' : ''}${S.extraMin} 分</span>
        <button data-act="exmin" data-d="5">＋</button>
      </div>
      <div class="srow-d">历史时区、地方性做法或别派算法用这里兜底，直接叠在真太阳时之上。</div>
    </div>

    <div class="set-g">起卦</div>

    <div class="srow">
      <div class="srow-t">梅花起卦</div>
      ${seg('mhMethod', [['time', '时间'], ['m1', '方法1'], ['m2', '方法2']])}
      <div class="srow-d">时间：年支＋月＋日取上卦，再加时辰取下卦与动爻。<br>
        方法1：报一串数字，从中间劈成前后两段，前段取上卦、后段取下卦，两段之和取动爻。<br>
        方法2：报三个数，数一取上卦、数二取下卦、数三取动爻。</div>
    </div>

    <div class="srow">
      <div class="srow-t">数字起卦计时辰</div>
      ${seg('mhAddHour', [['1', '开'], ['0', '关']])}
      <div class="srow-d">${数字
        ? '「取爻當以時加之」一句部分版本视为后加或错简，遂分两派。本工具一律<b>只把时辰加在动爻上</b>，上卦下卦不受影响；结果页会把本次用到的算式原样打出。'
        : '只对方法1、方法2有效；时间起卦本来就要用时辰。'}</div>
    </div>

    <div class="srow">
      <div class="srow-t">六爻筮法</div>
      ${seg('lyMethod', [['coin', '三钱法'], ['dayan', '大衍筮法']])}
      <div class="srow-d">三钱法三枚铜钱掷一次；大衍筮法蓍草十八变。摇卦按这里选的法子，六爻一爻一爻摇，共六次。</div>
    </div>

    <div class="srow">
      <div class="srow-t">小六壬六宫五行</div>
      ${seg('lrWuxing', [['shen', '六神本'], ['liu', '流传本']])}
      <div class="srow-d">六神本以所临六神定五行（留连水、小吉木）；流传本作留连土、小吉水。断辞两派相同，变的只是拿五行论生克的时候。</div>
    </div>

    <button class="reset" data-act="reset">恢复默认</button>
    <p class="hint" style="margin-top:12px">设置存在本机浏览器里，改完当下生效。地址栏加 <b>#settings</b> 可直接进来。</p>`;
  b.scrollTop = keep;
  updateNotch();
}

function handleSettingsClick(e) {
  const st = e.target.closest('[data-set]');
  if (st && !st.disabled) {
    const k = st.dataset.set;
    S[k] = BOOLKEYS.includes(k) ? st.dataset.val === '1' : st.dataset.val;
    SAVE();
    if (k === 'mhMethod' || k === 'mhAddHour') mhReset();
    renderSettings();
    return true;
  }
  if (e.target.closest('[data-act="city"]')) { openSheet('city'); return true; }
  const d = e.target.closest('[data-act="exmin"]');
  if (d) {
    // 只改这一个数字，不重画整页 —— 重画会把手指底下的按钮换掉，连点两下就丢一下
    S.extraMin = clamp(S.extraMin + Number(d.dataset.d), -720, 720);
    SAVE();
    d.parentElement.querySelector('.step-v').textContent =
      `${S.extraMin > 0 ? '+' : ''}${S.extraMin} 分`;
    return true;
  }
  const c = e.target.closest('[data-act="pickcity"]');
  if (c) {
    S.lon = Number(c.dataset.lon); S.lonName = c.dataset.name;
    SAVE();
    $('city-list').innerHTML = cityListHTML();
    renderSettings();
    return true;
  }
  if (e.target.closest('[data-act="lonok"]')) {
    const v = parseLon($('lon-in').value);
    const msg = $('lon-msg');
    if (v === null) { msg.textContent = '经度要在 −180 ~ 180 之间，例如 108.93'; return true; }
    S.lon = v; S.lonName = lonLabel(v); SAVE();
    $('city-list').innerHTML = cityListHTML();
    $('lon-in').value = '';
    msg.textContent = `已设为 ${lonLabel(v)} · 时差 ${lonOffset(v) >= 0 ? '+' : '−'}${Math.abs(lonOffset(v)).toFixed(0)} 分`;
    renderSettings();
    return true;
  }
  if (e.target.closest('[data-act="reset"]')) {
    S = { ...DEFAULTS };
    SAVE();
    mhReset();
    renderSettings();
    return true;
  }
  return false;
}

// ══ 数字键盘（方法1 / 方法2 报数）═════════════════════
const MH_NEED = { time: 0, m1: 1, m2: 3 };   // 各法要报几个数
const MH_WHO = {
  m1: ['报一串数字'],
  m2: ['报数一 · 上卦', '报数二 · 下卦', '报数三 · 动爻'],
};
const MH_MAX = 12;   // 方法1 位数上界：再长 Number 就要丢精度了

function renderMeihuaInput(msg) {
  const need = MH_NEED[S.mhMethod] || 1;
  const who = MH_WHO[S.mhMethod][mhInput.nums.length] || '';
  const chips = mhInput.nums.map((v, i) =>
    `<span class="chip${i === mhInput.nums.length ? ' on' : ''}">${MH_WHO[S.mhMethod][i]} <b>${v}</b></span>`).join('');
  const 满 = mhInput.buf.length >= (S.mhMethod === 'm1' ? MH_MAX : 3);
  $('meihua-body').innerHTML = `
    <div class="pad-top">
      ${mhInput.nums.length || S.mhMethod === 'm2' ? `<div class="chips">${chips}</div>` : ''}
      <div class="pad-num">${mhInput.buf || `<span class="pad-ph">${who}</span>`}</div>
      <p class="hint">${msg ? `<em class="warn">${esc(msg)}</em><br>`
        : `${need} 个数 · ${S.mhAddHour ? '计入时辰' : '不计时辰'}`}</p>
    </div>
    <div class="pad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-key="${d}">${d}</button>`).join('')}
      <button data-key="del">清除</button>
      <button data-key="0">0</button>
      <button data-key="ok" class="ok">确定</button>
    </div>
    <div class="acts">
      ${mhInput.nums.length ? '<button class="ghost" data-act="mh-reset">重 报</button>' : ''}
      <button class="ghost" data-act="mhpick">选 卦</button>
    </div>`;
}

function handleKeypad(e) {
  if (e.target.closest('[data-act="mh-reset"]')) { mhManual = null; mhReset(); renderMeihua(); return true; }
  const k = e.target.closest('[data-key]');
  if (!k) return false;
  const v = k.dataset.key;
  if (v === 'del') mhInput.buf = '';
  else if (v === 'ok') {
    if (!mhInput.buf) return true;                       // 还没报数，确定键不动
    if (S.mhMethod === 'm1' && mhInput.buf.length < 2) return renderMeihuaInput('至少两位数，从中间劈得开才成卦');
    mhInput.nums.push(Number(mhInput.buf));
    mhInput.buf = '';
    if (mhInput.nums.length >= (MH_NEED[S.mhMethod] || 1)) return renderMeihua(), true;   // 数齐了 → 出结果
    return renderMeihuaInput(), true;
  } else if (mhInput.buf.length < (S.mhMethod === 'm1' ? MH_MAX : 3)) mhInput.buf += v;
  renderMeihuaInput();
  return true;
}

// ══ 古籍块 ════════════════════════════════════════════
const guji = (h, t, s, c) =>
  `<div class="guji">`
  + (h ? `<div class="guji-h">${h}</div>` : '')
  + (t ? `<div class="guji-t">${t}</div>` : '')
  + (s ? `<div class="guji-s">${s}</div>` : '')
  + (c ? `<div class="guji-c">${c}</div>` : '') + '</div>';

// ══ 六爻 ══════════════════════════════════════════════
const yaoHTML = (yang) =>
  `<div class="yao">${yang ? '<i></i>' : '<i></i><i></i>'}</div>`;

// ── 摇卦：一爻两下，六爻共十二下 ──────────────────────
// 点「摇卦」铜钱开始抖，点「落定」定下**这一爻**，自初爻往上垒。
// 六爻都定下了才出卦盘。随机数在落定那一刻才取 —— 按的时机决定卦，
// 这正是仪式感的来源，也让「摇」这个动作真的参与进来。
let toss = null;            // null = 静止｜{ t0 } = 摇动中
let tossTimer = 0;
let lyLines = [];           // 已定下的爻值，自初爻起，长度 0..6
let lastCoins = null;       // 刚落定那一爻的三枚铜钱（2 字 / 3 背），大衍时为 null
let lyMode = 'shake';       // 'shake' 摇卦｜'manual' 手排
const SHAKE_MIN = 500;      // 最短摇动时间，免得手快连点两下直接跳过仪式
const SHAKE_MAX = 10000;    // 兜底：一直不落定就自己落定，不会卡在摇动中

const YAO_POS = ['初', '二', '三', '四', '五', '上'];
const YAO_VAL = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };

// 三钱法用铜钱，大衍用蓍草 —— 选了哪套就画哪套，不能张冠李戴。
// 铜钱有两面：正面「乾隆通宝」、背面素面。字为阴（2）、背为阳（3），
// 所以落定时停在哪一面是这一爻真掷出来的结果，不是随便转着玩的。
const coinHTML = (背) => `<span class="coin ${背 === undefined ? '' : 背 ? 'bei' : 'zi'}">`
  + `<span class="cf">${['乾', '隆', '通', '宝'].map((c, i) => `<i class="c${i}">${c}</i>`).join('')}</span>`
  + '<span class="cb"></span></span>';
const shakeVisualHTML = () => {
  if (S.lyMethod === 'dayan') return `<span class="stalks">${'<i></i>'.repeat(6)}</span>`;
  // 摇动中三枚都乱转（背传 undefined）；落定后各自停在掷出来的那一面
  const faces = toss ? [] : (lastCoins || []);
  return [0, 1, 2].map((i) => coinHTML(faces.length ? faces[i] === 3 : undefined)).join('');
};

function shakeVisual() {
  return `<div class="shake${toss ? ' on' : ''}">${shakeVisualHTML()}</div>`;
}

function shakeStart() {
  toss = { t0: Date.now() };
  renderLiuyaoIdle();
  tossTimer = setTimeout(shakeSettle, SHAKE_MAX);
}

// 落定 = 定下**这一爻**，不是整卦
function shakeSettle() {
  if (!toss) return;                                    // 已经被取消了
  clearTimeout(tossTimer);
  const left = SHAKE_MIN - (Date.now() - toss.t0);
  if (left > 0) { tossTimer = setTimeout(shakeSettle, left); return; }   // 补足最短摇动
  // 三钱法先掷出三枚再求和 —— 反过来先求和就反推不出每枚是哪面，铜钱落定就停不准了
  if (S.lyMethod === 'dayan') { lastCoins = null; lyLines.push(tossLine('dayan')); }
  else { lastCoins = tossCoins(); lyLines.push(coinsToLine(lastCoins)); }
  toss = null;
  if (lyLines.length < 6) { renderLiuyaoIdle(); return; }   // 还没摇满，接着摇下一爻
  renderLiuyao(lyLines);
}

function shakeCancel() { clearTimeout(tossTimer); toss = null; }

// 重开一局：爻值清空、模式回到摇卦。换板块、点「再掷」都走这里。
function resetLiuyao() {
  shakeCancel();
  lyLines = [];
  lastCoins = null;
  lyMode = 'shake';
}

const YAO_CYCLE = { 6: 7, 7: 8, 8: 9, 9: 6 };

function handleLiuyaoClick(e) {
  const cyc = e.target.closest('[data-act="lycyc"]');
  if (cyc) {
    const i = Number(cyc.dataset.i);
    lyLines[i] = YAO_CYCLE[lyLines[i] ?? 7];
    renderLiuyaoIdle();                          // 手排态下不会重进结果页，改完接着改
    return true;
  }
  if (e.target.closest('[data-act="lyok"]')) { renderLiuyao(lyLines); return true; }
  if (e.target.closest('[data-act="lymanual"]')) {
    // 带着已摇出的爻进手排，免得重头点六下
    lyLines = Array.from({ length: 6 }, (_, i) => lyLines[i] ?? 7);
    lyMode = 'manual';
    renderLiuyaoIdle();
    return true;
  }
  if (e.target.closest('[data-act="lyshake"]')) {
    resetLiuyao();
    renderLiuyaoIdle();
    return true;
  }
  if (e.target.closest('[data-act="again"]')) {
    resetLiuyao();
    renderLiuyaoIdle();
    return true;
  }
  return false;
}

// 所有触发都走这一个入口 —— 点击是它，将来的加速度计也是它
function shakeTrigger() { toss ? shakeSettle() : shakeStart(); }

// 摇动检测。演示版是空实现：桌面上没有加速度计，装了监听也只是白占一份开销。
// 第二版到手表上时在这里接，上层一行都不用动：
//
//   const SHAKE_G = 18, SHAKE_GAP = 400;   // 静止时模长 ≈ 9.8，抬手晃一下能过 20
//   let lastShake = 0;
//   window.addEventListener('devicemotion', (e) => {
//     const a = e.accelerationIncludingGravity;
//     if (!a || Math.hypot(a.x, a.y, a.z) < SHAKE_G) return;
//     if (Date.now() - lastShake < SHAKE_GAP) return;
//     lastShake = Date.now();
//     shakeTrigger();
//   });
//
// shakeTrigger 是**开关**语义，所以「晃一下开始、再晃一下落定」和
// 「晃一下开始、十秒后自动落定」两种接法都不用改上层。
function bindMotion() { /* 演示版不接传感器，见上 */ }

// 摇卦进行中的六行：已定下的爻自下而上垒着，没摇到的位置留个虚位，
// 让人一眼看得出摇到第几爻了。最新落定的那爻单独给一段入场动画。
function stackHTML() {
  const fresh = lyLines.length - 1;
  const rows = [];
  for (let i = 5; i >= 0; i--) {
    const v = lyLines[i];
    if (v === undefined) {
      rows.push(`<div class="row pending"><span class="nj">${YAO_POS[i]}</span><div class="yao ph"></div></div>`);
    } else {
      const 动 = v === 6 || v === 9;
      rows.push(`<div class="row still${动 ? ' dong' : ''}${i === fresh ? ' fresh' : ''}">`
        + `<span class="nj">${YAO_POS[i]}</span>${yaoHTML(v === 7 || v === 9)}`
        + `<span class="mark">${动 ? '动' : ''}</span></div>`);
    }
  }
  return `<div class="pan stack">${rows.join('')}</div>`;
}

function renderLiuyaoIdle() {
  $('liuyao-day').textContent = '';

  if (lyMode === 'manual') {
    // 手排：六行各是一个按钮，点一下在这爻的四种状态里循环
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      const v = lyLines[i] ?? 7;
      const 动 = v === 6 || v === 9;
      // 类名走 pickrow，别图短写 pick：设置页那行同名的 .pick 会把它顶掉（见 style.css）。
      // 整行可点就够了，语义上不是按钮也不打紧。
      rows.push(`<div class="row pickrow${动 ? ' dong' : ''}" data-act="lycyc" data-i="${i}">`
        + `<span class="nj">${YAO_POS[i]}爻</span>${yaoHTML(v === 7 || v === 9)}`
        + `<span class="mark">${YAO_VAL[v]}</span></div>`);
    }
    $('liuyao-body').innerHTML = `
      <div class="pan stack">${rows.join('')}</div>
      <p class="hint">点每一爻切换：老阴 → 少阳 → 少阴 → 老阳。老阴老阳为动爻。</p>
      <div class="acts">
        <button class="toss" data-act="lyok">成 卦</button>
        <button class="ghost" data-act="lyshake">回摇卦</button>
      </div>`;
    return;
  }

  const n = lyLines.length;
  const label = toss ? '落 定'
    : n === 0 ? '摇 卦'
    : `摇 ${YAO_POS[n]}爻`;
  const hint = toss ? '再点一次，定下这一爻'
    : S.lyMethod === 'dayan' ? '大衍筮法 · 蓍草十八变' : '三钱法 · 三枚铜钱，字为阴 背为阳';

  $('liuyao-body').innerHTML = `
    <div class="toss-page">
      ${n > 0 ? stackHTML() : ''}
      <div class="toss-wrap${n > 0 ? ' compact' : ''}">
        ${shakeVisual()}
        <button class="toss" data-act="toss">${label}</button>
        <p class="hint">${toss ? hint : `已定 ${n} / 6 爻　·　${hint}`}</p>
        ${n > 0 ? '' : '<button class="ghost" data-act="lymanual">手 排</button>'}
      </div>
    </div>`;
}

function renderLiuyao(vals) {
  const n = nowInfo();
  const p = paipan(vals, n.日干支);
  $('liuyao-day').innerHTML = `${wxGZ(n.日干支)}日 · ${n.晚子 ? '晚子' : n.时辰名}时`;

  // 自上而下显示（上爻在最上）；摇卦自初爻起，故延迟倒序
  const rows = [...p.爻].reverse().map((y, i) => {
    const mark = y.世 ? '世' : y.应 ? '应' : '';
    return `<div class="row${y.动 ? ' dong' : ''}" style="--i:${5 - i}">
      <span class="shen">${y.六神}</span>
      <span class="nj">${wxGZ(y.纳甲)}</span>
      <span class="qin">${y.六亲}</span>
      ${yaoHTML(y.阴阳 === '阳')}
      <span class="mark">${mark}${y.动 ? (y.值 === 9 ? '○' : '×') : ''}</span>
    </div>`;
  }).join('');

  const j = YIJING[p.本卦.卦];
  const jb = p.变卦 ? YIJING[p.变卦.卦] : null;

  // 动爻爻辞 —— 六爻真正要看的就是这几条。原文小象以「象曰：」起头，数据里没带。
  const 动爻 = p.爻.filter((y) => y.动);
  const dongGuji = 动爻.map((y) => {
    const src = YIJING[p.本卦.卦]?.爻?.[y.位 - 1];
    if (!src) return '';
    return guji(`动爻 第 ${y.位} 爻 · ${src.题}`, esc(src.辞),
      `象曰：${esc(src.象)}`, '《周易》原文 · 繁体');
  }).join('');

  $('liuyao-body').innerHTML = `
    <div class="sec">
      <div class="gua-head">
        <span class="gua-name">${p.本卦.卦}</span>
        <span class="gua-meta">${p.本卦.宫}宫 · ${p.本卦.世应序} · 世${p.本卦.世爻}应${p.本卦.应爻}</span>
      </div>
      <div class="pan">${rows}</div>
      ${p.变卦
        ? `<p class="hint" style="margin-top:10px">变卦 ${p.变卦.卦} · ${p.变卦.宫}宫　动爻 ${p.动爻数} 个</p>`
        : `<p class="hint" style="margin-top:10px">六爻皆静 · 无变卦</p>`}
    </div>

    <div class="sec">
      <div class="sec-h">《周易》原文</div>
      ${j ? guji(`本卦 卦辞 · 第 ${j.序} 卦`, esc(j.卦辞), `彖曰：${esc(j.彖)}`)
          + guji('本卦 大象', `象曰：${esc(j.大象)}`) : ''}
      ${dongGuji}
      ${动爻.length ? '' : '<p class="hint">六爻皆静，以本卦卦辞断。</p>'}
      ${jb ? guji(`变卦 ${jb.序} · ${p.变卦.卦}`, esc(jb.卦辞), `象曰：${esc(jb.大象)}`) : ''}
      <p class="hint" style="margin-top:8px">《周易》原文 · 繁体 · 据 Project Gutenberg 公版《易經》</p>
    </div>

    <div class="sec">
      <div class="sec-h">再摇一卦</div>
      <div class="acts">
        <button class="toss" data-act="again">再 掷</button>
        <button class="ghost" data-act="lymanual">手 排</button>
      </div>
    </div>`;
}

// ══ 小六壬 ════════════════════════════════════════════
function renderLiuren() {
  const n = nowInfo();
  const m = lrManual || { 月: n.月, 日: n.日, 时: n.时辰 };
  const r = qike(m.月, m.日, m.时, S.lrWuxing);

  const 月名 = lrManual ? `${m.月} 月` : `${n.闰 ? '闰' : ''}${n.月名}月`;
  const 日名 = lrManual ? `${m.日} 日` : n.日名;

  const stepRow = (k, label, v, lo, hi, fmt) => `<div class="step-row">
      <span class="step-l">${label}</span>
      <div class="step">
        <button data-act="lrst" data-k="${k}" data-d="-1" data-lo="${lo}" data-hi="${hi}">−</button>
        <span class="step-v">${fmt(v)}</span>
        <button data-act="lrst" data-k="${k}" data-d="1" data-lo="${lo}" data-hi="${hi}">＋</button>
      </div>
    </div>`;

  $('liuren-body').innerHTML = `
    <div class="sec">
      <div class="gong-name">${r.宫}</div>
      <div class="gong-wx">第 ${r.序} 宫 · ${r.五行} · ${r.神煞} · ${r.方位}方${r.色}</div>
      <div class="gong-duan">${r.断}</div>
      <p class="hint" style="margin-top:8px">
        ${月名}${日名} · ${lrManual ? ZHI[m.时 - 1] + '时' : (n.晚子 ? '晚子' : n.时辰名 + '时')}
        　（月${m.月} 日${m.日} 时${m.时}）
      </p>
    </div>

    <div class="sec">
      <div class="sec-h">${r.宫} 断辞 · 谋事主 ${r.数}</div>
      ${guji('', r.诀, '',
        `据《玉匣记》一系断辞本 · 六宫五行取${S.lrWuxing === 'liu' ? '流传本' : '六神本'}`)}
    </div>

    ${lrManual ? `
      <div class="sec">
        <div class="sec-h">手定 月 · 日 · 时辰</div>
        ${stepRow('月', '月', m.月, 1, 12, (v) => `${v} 月`)}
        ${stepRow('日', '日', m.日, 1, 30, (v) => `${v} 日`)}
        ${stepRow('时', '时', m.时, 1, 12, (v) => `${ZHI[v - 1]}时`)}
        <p class="hint">手动指定的月日时不受真太阳时影响，也不随钟点变。</p>
      </div>
      <div class="acts"><button class="ghost" data-act="lrauto">按 时</button></div>`
    : `<div class="acts"><button class="ghost" data-act="lrmanual">手 定</button></div>`}`;
}

function handleLiurenClick(e) {
  if (e.target.closest('[data-act="lrmanual"]')) {
    const n = nowInfo();
    lrManual = lrManual || { 月: n.月, 日: n.日, 时: n.时辰 };
    renderLiuren();
    return true;
  }
  if (e.target.closest('[data-act="lrauto"]')) { lrManual = null; renderLiuren(); return true; }
  const st = e.target.closest('[data-act="lrst"]');
  if (st && lrManual) {
    const k = st.dataset.k, lo = Number(st.dataset.lo), hi = Number(st.dataset.hi);
    lrManual[k] = clamp(lrManual[k] + Number(st.dataset.d), lo, hi);
    renderLiuren();
    return true;
  }
  return false;
}

// ══ 梅花易数 ══════════════════════════════════════════
// 一个入口按当前状态分派：选卦 > 方法1/方法2 报数 > 时间起卦。
function renderMeihua() {
  const n = nowInfo();
  if (mhManual) {
    const r = qiguaDirect(mhManual.上, mhManual.下, mhManual.动爻);
    r.法 = '选卦 · 手动指定';
    r.式 = [`上卦 ${mhManual.上}　下卦 ${mhManual.下}　动爻 第 ${mhManual.动爻} 爻`];
    return renderMeihuaResult(r);
  }
  if (S.mhMethod === 'm1') {
    if (!mhInput.nums.length) return renderMeihuaInput();
    return renderMeihuaResult(qiguaSplit(mhInput.nums[0], n.时辰, S.mhAddHour));
  }
  if (S.mhMethod === 'm2') {
    if (mhInput.nums.length < 3) return renderMeihuaInput();
    return renderMeihuaResult(qiguaThree(...mhInput.nums.slice(0, 3), n.时辰, S.mhAddHour));
  }
  return renderMeihuaResult(qigua(n.年, n.月, n.日, n.时辰));
}

// ── 选卦：八个八卦格各选一次，再点动爻 ──
function renderMeihuaPick() {
  const g = mhManual;
  const grid = (f) => ORDER.map((x) =>
    `<button class="gpick${g[f] === x ? ' on' : ''}" data-act="mhgp" data-f="${f}" data-g="${x}">`
    + `<span class="gp-s">${SYM[x]}</span><span class="gp-n">${x}</span></button>`).join('');
  $('meihua-body').innerHTML = `
    <div class="sec">
      <div class="sec-h">上卦（外卦）</div>
      <div class="gpickgrid">${grid('上')}</div>
      <div class="sec-h" style="margin-top:12px">下卦（内卦）</div>
      <div class="gpickgrid">${grid('下')}</div>
      <div class="step-row" style="margin-top:12px">
        <span class="step-l">动爻</span>
        <div class="step">
          <button data-act="mhst" data-d="-1">−</button>
          <span class="step-v">第 ${g.动爻} 爻 · ${YAO_POS[g.动爻 - 1]}</span>
          <button data-act="mhst" data-d="1">＋</button>
        </div>
      </div>
    </div>
    <div class="acts">
      <button class="toss" data-act="mhok">成 卦</button>
      <button class="ghost" data-act="mhauto">回自动</button>
    </div>`;
}

function handleMeihuaPick(e) {
  if (e.target.closest('[data-act="mhpick"]')) {
    mhManual = mhManual || { 上: '乾', 下: '乾', 动爻: 1 };
    renderMeihuaPick();
    return true;
  }
  if (e.target.closest('[data-act="mhauto"]')) {
    mhManual = null;
    mhReset();
    renderMeihua();
    return true;
  }
  const gp = e.target.closest('[data-act="mhgp"]');
  if (gp && mhManual) {
    mhManual[gp.dataset.f] = gp.dataset.g;
    renderMeihuaPick();
    return true;
  }
  const st = e.target.closest('[data-act="mhst"]');
  if (st && mhManual) {
    mhManual.动爻 = ((mhManual.动爻 - 1 + Number(st.dataset.d) + 6) % 6) + 1;
    renderMeihuaPick();
    return true;
  }
  if (e.target.closest('[data-act="mhok"]') && mhManual) { renderMeihua(); return true; }
  return false;
}

function renderMeihuaResult(m) {
  const ty = tiYongWuXing(m.体, m.用);
  // 三卦竖排。每卦把上卦、下卦拆成两行标出来 —— 体用落在哪一半全看上卦下卦，
  // 挨在一起的两个符号在窄屏上既挤、也看不出哪半是上卦。
  // 本卦那两行额外挂「体」「用」小标，取象就是按这两个字去查的。
  const 标 = { 上: m.体 === m.本卦.上 ? '体' : '用', 下: m.体 === m.本卦.下 ? '体' : '用' };
  const card = (k, g, mark) => `<div class="guarow">
      <div class="gr-h"><span class="k">${k}</span><span class="v">${g.名}</span></div>
      ${['上', '下'].map((f) => `<div class="trig">
        <span class="tt">${f}卦</span><span class="ts">${SYM[g[f]]}</span><span class="tn">${g[f]}</span>
        ${mark ? `<span class="tb tb-${mark[f] === '体' ? 'ti' : 'yong'}">${mark[f]}</span>` : ''}
      </div>`).join('')}
    </div>`;

  // 取象：体卦、用卦各查一次〈八卦萬物屬類〉。
  // 这一节顶掉的正是原先那套「体克用→诸事吉」的生克断语 —— 那套把六十四卦
  // 压成五个标签，读起来比卦本身还硬；取象才是把卦还原成具体东西的那一步。
  const 象 = (k, g) => (WANWU[g] ? `<div class="xiang">
      <div class="xiang-h"><span class="tb tb-${k === '体' ? 'ti' : 'yong'}">${k}</span><span class="xn">${g}</span></div>
      <div class="xiang-l">${WANWU[g].map(esc).join('<i>·</i>')}</div>
    </div>` : '');

  // 原文：梅花真正要看的是动爻那一爻的爻辞，其次本卦卦辞与大象
  const j = YIJING[m.本卦.名];
  const jb = YIJING[m.变卦.名];
  const src = j?.爻?.[m.动爻 - 1];

  $('meihua-body').innerHTML = `
    <div class="sec">
      <div class="mh-fa">${esc(m.法)}</div>
      <div class="tri">${card('本卦', m.本卦, 标)}${card('互卦', m.互卦)}${card('变卦', m.变卦)}</div>
      <p class="hint" style="margin-top:10px">
        动爻 第 ${m.动爻} 爻　体 <b style="color:var(--ink)">${m.体}</b>（${ty.体五行}）
        　用 <b style="color:var(--ink)">${m.用}</b>（${ty.用五行}）
      </p>
    </div>

    <div class="sec">
      <div class="sec-h">取象 ·〈八卦萬物屬類〉</div>
      ${象('体', m.体)}${象('用', m.用)}
    </div>

    <div class="sec">
      <div class="sec-h">《周易》原文</div>
      ${j ? guji(`本卦 卦辞 · 第 ${j.序} 卦`, esc(j.卦辞), `彖曰：${esc(j.彖)}`) : ''}
      ${src ? guji(`动爻 第 ${m.动爻} 爻 · ${src.题}`, esc(src.辞), `象曰：${esc(src.象)}`) : ''}
      ${jb ? guji(`变卦 ${jb.序} · ${m.变卦.名}`, esc(jb.卦辞), `象曰：${esc(jb.大象)}`) : ''}
      <p class="hint" style="margin-top:8px">《周易》原文 · 繁体 · 据 Project Gutenberg 公版《易經》</p>
    </div>

    <div class="sec">
      <div class="sec-h">起卦过程</div>
      <p class="gong-duan" style="font-size:11px">${m.式.map((l) => esc(l)).join('<br>')}</p>
    </div>

    <div class="sec">
      <div class="sec-h">再来一卦</div>
      <div class="acts">
        <button class="toss" data-act="mh-reset">重 报</button>
        <button class="ghost" data-act="mhpick">选 卦</button>
      </div>
    </div>`;
}

// ══ ⓘ 弹层 ════════════════════════════════════════════
const SRCNET = '<div class="src">古籍原文均取自公有领域文献：'
  + '《周易》据 Project Gutenberg 公版《易經》(eBook #25501)；'
  + '《梅花易数·卷二》据维基文库本；小六壬断辞据《玉匣记》一系传本。'
  + '原文保持繁体原貌，未作繁简转换。本工具只排盘、只列原文，不出结论性解读。</div>';

const TOPICS = {
  about: {
    t: '关于', h: `
      <h4>这是什么</h4>
      <p>一个把三套术数算法完整实现出来的排演工具。做两件事：<b>按规则排出盘</b>，
      以及<b>把古籍原文摊开给你看</b>。不接大模型、不需联网、不上架、不收费。</p>
      <h4>三套算法</h4>
      <p><b>六爻</b>　三钱摇卦 + 京房八宫装卦：纳甲、六亲、六神、世应、旬空。</p>
      <p><b>小六壬</b>　月上起日、日上起时，落六宫之一。</p>
      <p><b>梅花易数</b>　时间起卦与方法1、方法2 数字起卦，分体用，取互卦变卦。</p>
      <p>三个板块<b>各自成页、互不影响</b>：进去之后就是那一个板块，表冠只在页内滚动，
      换板块要先按 ‹ 回首页。每一处都给了一个<b>手动指定入口</b>（六爻「手排」、
      小六壬「手定」、梅花「选卦」），不想起卦、只想查某一卦时用。</p>
      <h4>首页的四柱</h4>
      <p>年月日时各一组干支。年柱以<b>立春</b>为界，月柱以<b>节气</b>为界（都是日期粒度，
      不精确到交接时刻），日柱 00:00 换日。</p>
      <p><b>月柱和农历月不是一回事</b>：月柱走节气，农历月是朔望月，两者在交节前后会差一个月。
      梅花易数的时间起卦吃的是<b>农历月数字</b>，不是月柱，两边不一样是正常的。</p>
      <p>时柱由本工具认定的日柱按<b>五鼠遁</b>推出（甲己还加甲、乙庚丙作初……），
      所以它跟日柱永远自洽。晚子时那一派分歧改的是日柱，时柱跟着一起变。</p>
      <h4>把分歧交给你</h4>
      <p>术数各派在几处关键地方做法不同，本工具不替你选，默认取主流，全部放在<b>设置</b>页：
      晚子时、真太阳时与经度、梅花起卦方式与是否计时辰、六爻筮法、六宫五行。</p>
      <h4>操作</h4>
      <p>拖动表体可 360° 看；拖动右侧表冠<b>只在本页内滚动</b>，滚到头就停，不会翻到别的板块；
      页面上那个圈 i 是这一页的原理与出处；首页右上角齿轮进设置。</p>` + SRCNET,
  },
  liuyao: {
    t: '六爻 · 原理与出处', h: `
      <h4>起卦</h4>
      <p>三枚铜钱掷一次，字面记 2、背面记 3，三枚之和得 <b>6 / 7 / 8 / 9</b>：
      6 老阴、7 少阳、8 少阴、9 老阳。自初爻摇到上爻，<b>共摇六次</b>，一次定一爻。
      老阴老阳为动爻。</p>
      <p>摇卦是<b>一爻两下</b>：点「摇卦」铜钱开始抖，点「落定」才定下这一爻。
      随机数在落定那一刻才取 —— 按的时机决定卦，所以「摇」这个动作是真的参与进来的。</p>
      <h4>两种筮法</h4>
      <p>三钱法三枚铜钱掷一次；大衍筮法蓍草十八变，老阳明显偏多。两者出爻的分布不同，
      但都落在 6 / 7 / 8 / 9 这四个值上，往下装卦的走法完全一样，在<b>设置</b>里切换。</p>
      <h4>装卦不用查表</h4>
      <p>六十四卦的宫属和世爻是<b>推</b>出来的：本宫 → 一世（变初爻）→ 二世 → 三世 →
      四世 → 五世 → 游魂（五世再变四爻）→ 归魂（游魂内卦全变）。
      世爻依次落在 <b>6, 1, 2, 3, 4, 5, 4, 3</b> 爻，应爻取世爻 ±3。</p>
      <p>六亲由卦宫五行与纳甲地支五行生克定；六神按日干起；旬空由日干支所在旬推。
      可跑 <b>node test.mjs</b> 用乾宫八卦自校验。</p>
      <h4>原文</h4>
      <p>结果页按顺序给出：本卦卦辞与彖传、大象辞，<b>每一个动爻的爻辞与小象</b>，
      以及变卦的卦辞与大象辞。六爻真正要看的正是动爻那几爻的爻辞。</p>` + SRCNET,
  },
  liuren: {
    t: '小六壬 · 原理与出处', h: `
      <h4>落宫</h4>
      <p>大安起月，月上起日，日上起时，写成一行就是：</p>
      <p style="text-align:center;color:var(--hi);font-size:13px">
        落宫 =（月 + 日 + 时辰 − 3）mod 6</p>
      <p>平时吃的是当前农历月、农历日与时辰；点「手定」可以直接把月、日、时辰摆成任意值，
      不受真太阳时影响，也不随钟点变 —— 拿来查某个特定月日时落在哪一宫。</p>
      <h4>六宫五行</h4>
      <p>六宫所临六神是固定的：大安青龙、留连玄武、速喜朱雀、赤口白虎、小吉六合、空亡勾陈。
      以六神定五行则大安木、速喜火、赤口金、空亡土，<b>留连属水、小吉属木</b>——本工具默认取这一套。</p>
      <p>另有流传本作<b>留连土、小吉水</b>，两派都有人用。断辞两派相同，变的只是拿五行论生克时，
      所以在<b>设置</b>里给了开关。方位与颜色随五行走，免得出现「五行土却属北方黑」这种自相矛盾的显示。</p>
      <h4>断辞</h4>
      <p>结果页给出该宫的传本断辞。断辞只说这一宫主什么状态，不下吉凶结论。</p>` + SRCNET,
  },
  meihua: {
    t: '梅花易数 · 原理与出处', h: `
      <h4>起卦</h4>
      <p>原文「卦以八除……如得八數整，即坤卦，更不必除也」；「爻以六除」。所以数除以 8
      取余为上卦、另数取余为下卦，再取余为动爻，<b>余 0 一律作 8（坤）或 6（上爻）</b>。</p>
      <p>三种起卦法的结构完全一样，只有「哪几个数相加」不同：</p>
      <p><b>时间起卦</b>　年支（子 1 … 亥 12）＋ 农历月 ＋ 日 取上卦，再加时辰取下卦与动爻。</p>
      <p><b>方法1</b>　报一串数字，<b>从中间劈开</b>成前后两段（前段位数不多于后段，
      如 12345 劈作 12 与 345）。前段取上卦、后段取下卦，两段之和取动爻。</p>
      <p><b>方法2</b>　报三个数：数一取上卦、数二取下卦、数三取动爻。</p>
      <p>另有<b>选卦</b>入口：直接点出上下卦与动爻，不起卦只查卦时用。</p>
      <h4>「取爻當以時加之」这句有争议</h4>
      <p>原书这句是全部分歧的源头，部分版本视其为后加或错简，于是分成两派：一派照原文
      <b>计入时辰</b>，一派认为数字属先天、<b>不计时辰</b>。设置里两种都留着，结果页会把本次
      实际用到的算式原样打在屏幕上。</p>
      <p>本工具一律<b>只把时辰加在动爻上</b>，上卦下卦不受影响。要注意<b>没有原文说过数字
      起卦不须加时辰</b>，那只是现代教程的推断。</p>
      <h4>体用</h4>
      <p>动爻所在的那一卦为<b>用</b>，另一卦为<b>体</b>。体为己身，用为所应之事。
      两者的五行关系决定断语，见结果页引的《体用总诀》。</p>` + SRCNET,
  },
  settings: {
    t: '设置 · 两处流派分歧', h: `
      <h4>为什么要给开关</h4>
      <p>这几个地方各派做法不同，没有公认的对错，本工具不替你选。默认值取的是主流写法，
      改完当下生效，存在本机浏览器里。</p>
      <h4>晚子时</h4>
      <p>子时从 23:00 起算，所以 23:00–24:00 这一段既属于今天的末尾、又已经是次日的子时。
      是连农历日与日干支一起挪到次日（<b>子时换日</b>，主流排盘软件），还是日子不动、
      只把时辰标成<b>晚子时</b>，两派都有。三个引擎都要吃这几个数，所以差别会一路传到结果上。</p>
      <h4>真太阳时</h4>
      <p>钟表走的是一整时区的平均太阳时，跟当地太阳真正过子午线的时刻差两块：
      <b>经度修正</b>（经度 − 120）× 4 分钟，和<b>均时差</b>（地球轨道偏心率与黄赤交角造成的
      全年 ±16 分钟浮动）。西安要往回拨 44 分、乌鲁木齐 130 分，足以整体挪掉一个时辰，
      所以这不是锦上添花，是正确性问题。</p>
      <p><b>夏令时为什么不用另设开关</b>：本工具一律从 UTC 起算再按经度校正，而真太阳时只取决于
      UTC 与经度，跟民用时区没有关系——夏令时、冬令时因此天然已被正确处理。
      历史时区或别派算法要额外干预，用<b>额外时差</b>那一项兜底。</p>` + SRCNET,
  },
  city: {
    t: '经度', h: `
      <p>经度只用来算真太阳时的偏移：<b>（经度 − 120）× 4 分钟</b>。
      北京时间的基准子午线是东经 120°，所以越往西越要往回拨。</p>
      <h4>省会 / 直辖市 / 港澳台</h4>
      <div id="city-list">${cityListHTML()}</div>
      <h4>手动输入经度</h4>
      <div class="lonrow">
        <input id="lon-in" type="text" inputmode="decimal" placeholder="例如 108.93">
        <button data-act="lonok">确定</button>
      </div>
      <p class="hint" id="lon-msg">东经为正、西经为负，范围 −180 ~ 180。</p>`,
  },
};

function openSheet(topic) {
  const s = $('sheet');
  if (!topic) { s.classList.remove('open'); updateNotch(); return; }
  const T = TOPICS[topic];
  $('sheet-title').textContent = T.t;
  $('sheet-body').innerHTML = T.h;
  $('sheet-body').scrollTop = 0;
  s.classList.add('open');
  updateNotch();
}

// ══ 启动 ══════════════════════════════════════════════
// #liuyao 进入掷卦　#liuyao:789786 直接摆出爻值（录屏复现用）　#sheet:liuren 直接开说明
buildShell();
applyView();
bindMotion();
renderHome();
const [route, arg] = location.hash.slice(1).split(':');
if (PAGE_ORDER.includes(route)) go(route);
if (route === 'liuyao' && /^[6789]{6}$/.test(arg || '')) {
  lyLines = [...arg].map(Number);
  renderLiuyao(lyLines);
}
if (route === 'sheet' && TOPICS[arg]) openSheet(arg);
setTimeout(() => $('tips').classList.add('fade'), 6000);
