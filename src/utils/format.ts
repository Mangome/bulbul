/**
 * 格式化毫秒为 "m:ss" 格式
 *
 * 例：125000ms → "2:05"，5000ms → "0:05"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
