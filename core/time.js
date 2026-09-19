// 真太阳时
//
//   真太阳时 = 民用时区时刻 + 经度修正 + 均时差
//            = UTC + 时区偏移 + (经度 − 120) × 4 分 + 均时差
//
// 做法是：把"此刻"整体挪成一个新的时间戳，使得用 getUTC* 读出来的数字
// 正好等于我们要显示的墙钟时刻。三个引擎再统一从这个时刻推农历、干支、时辰。
//
// 时区偏移直接问 getTimezoneOffset()：它对**某一个具体时刻**给出当时生效的偏移，
// 所以夏令时/冬令时天然就是对的，不需要单独的开关。
// 注意别漏掉时区这一项 —— 只加经度修正的话，真太阳时关掉时读到的就是 UTC，
// 在东八区会整体差 8 小时，跨零点还会把农历日算错一天。

// 均时差（分钟），即 真太阳时 − 平太阳时。取常用的傅里叶近似，全年误差 < 0.5 分。
// 对照公认值：2/11 −14.2、5/14 +3.7、7/26 −6.5、11/3 +16.4
export function eot(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const n = Math.floor((date.getTime() - start) / 86400000) + 1;   // 一年中的第几天
  const b = (2 * Math.PI * (n - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

// 经度修正：东经 120° 是北京时间的基准子午线，每偏离 1° 差 4 分钟
export const lonOffset = (lon) => (lon - 120) * 4;

// 真太阳时相对民用时的修正量（分钟）。关掉开关就只剩额外时差。
export const solarCorrection = (now, s) =>
  (s.trueSolar ? lonOffset(s.lon) + eot(now) : 0) + (s.extraMin || 0);

// 总共要挪多少分钟 —— 含民用时区，挪完用 getUTC* 读就是墙钟时刻
export const shiftMinutes = (now, s) => -now.getTimezoneOffset() + solarCorrection(now, s);

// 把"此刻"换算成要显示的墙钟时刻
export function solarNow(now, s) {
  const min = shiftMinutes(now, s);
  return min === 0 ? now : new Date(now.getTime() + min * 60000);
}

// 晚子时：子时从 23:00 起算，23:00–24:00 这一段的农历日与日干支怎么算，两派不同。
//   roll = 子时换日，连日子一起挪到次日（主流排盘软件）
//   keep = 夜子时，日子不动，只把时辰标成晚子时
// 农历的"日"没有对应的 23 点换日方法（干支有 getDayInGanZhiExact，日号没有），
// 所以直接整天挪日期，最省事也最不容易错。
export function lateZiDay(t, mode) {
  return (t.getUTCHours() >= 23 && mode === 'roll') ? new Date(t.getTime() + 3600e3) : t;
}

// 离最近的时辰边界还有几分钟。真太阳时会挪动时刻，压在边界上时结果很容易翻转，
// 界面要能提示"你正处在时辰交界附近"。
export function minutesToBoundary(date) {
  const m = date.getUTCHours() * 60 + date.getUTCMinutes();
  // 时辰边界在两小时整点，但子时从 23:00 起算，所以边界是 23,1,3,5,...,21
  const into = (m - 23 * 60 + 1440) % 120;   // 距上一个边界过了多少分钟
  return Math.min(into, 120 - into);
}
