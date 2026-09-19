// 用户设置。每一处术数流派分歧都在这里给一个开关，默认取主流写法。
//
// localStorage 只出现在本文件的两个函数里 —— 这是全项目唯一用到浏览器存储的地方。
// 移植到 Lite Wearable 时只要换掉 load/save 这两个函数（华为有对应的存储 API），
// 其余代码一行都不用动。
const KEY = 'hexagram-lab.settings.v1';

export const DEFAULTS = {
  // 晚子时：23:00–24:00 怎么算
  //   roll = 子时换日，23 点一过就算次日（主流排盘软件）
  //   keep = 夜子时，仍算当日，只把时辰标注为晚子时（少数派）
  lateZi: 'roll',

  // 真太阳时。关掉就直接用系统本地时刻（平太阳时）
  trueSolar: true,
  lon: 120,              // 经度，默认 120°E —— 北京时间的基准子午线
  lonName: '东经 120°',   // 只用于界面显示
  extraMin: 0,           // 额外时差修正（分钟）。夏令时不需要它，见 core/time.js

  // 梅花起卦：time = 年月日时 / m1 = 方法1（一串数字从中间劈开）/ m2 = 方法2（三个数各管一段）
  // ⚠ 键名必须和 app.js 设置页写进去的**一模一样**。这里曾写成 single/double，
  //   而界面写的是 m1/m2，于是下面 load() 的校验全判非法、静默回落 time ——
  //   表现就是「选了方法1，刷新一下又变回时间起卦」。
  mhMethod: 'time',
  mhAddHour: true,       // 数字起卦是否把时辰计进去

  // 六爻筮法：coin = 三钱法 / dayan = 大衍筮法
  lyMethod: 'coin',

  // 小六壬六宫五行：shen = 六神本（留连水、小吉木）/ liu = 流传本（留连土、小吉水）
  lrWuxing: 'shen',
};

export function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const o = JSON.parse(raw);
    // 逐项校验：存的东西可能是旧版本、也可能被手改坏，坏项一律回落默认值
    const out = { ...DEFAULTS };
    if (o.lateZi === 'roll' || o.lateZi === 'keep') out.lateZi = o.lateZi;
    if (typeof o.trueSolar === 'boolean') out.trueSolar = o.trueSolar;
    if (typeof o.lon === 'number' && o.lon >= -180 && o.lon <= 180) out.lon = o.lon;
    if (typeof o.lonName === 'string') out.lonName = o.lonName;
    if (typeof o.extraMin === 'number' && Math.abs(o.extraMin) <= 720) out.extraMin = o.extraMin;
    if (['time', 'm1', 'm2'].includes(o.mhMethod)) out.mhMethod = o.mhMethod;
    if (typeof o.mhAddHour === 'boolean') out.mhAddHour = o.mhAddHour;
    if (o.lyMethod === 'coin' || o.lyMethod === 'dayan') out.lyMethod = o.lyMethod;
    if (o.lrWuxing === 'shen' || o.lrWuxing === 'liu') out.lrWuxing = o.lrWuxing;
    return out;
  } catch (e) {
    // 隐私模式等场景下 localStorage 会直接抛异常，静默回落默认值即可
    return { ...DEFAULTS };
  }
}

export function save(s) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存不了就算了 */ }
}
