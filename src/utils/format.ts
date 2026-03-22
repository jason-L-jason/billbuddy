/** 格式化金额：¥8,234.50 */
export function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 格式化日期：01-15 12:30 */
export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

/** 格式化完整日期：2025-01-15 12:30:45 */
export function formatFullDate(isoString: string): string {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/** 格式化月份显示：2025年1月 */
export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  return `${year}年${parseInt(month)}月`;
}

/** 百分比格式化 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
