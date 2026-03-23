import { Transaction, CATEGORY_COLORS, CategoryType } from '@/types';
import { getDaysInMonth } from '@/utils/month';
import type { CategoryItem } from '@/utils/stats';

// ====== 每日消费折线图 ======

export function getDailyTrendOption(
  transactions: Transaction[],
  prevTransactions: Transaction[],
  month: string,
  prevMonth: string,
) {
  const daysInMonth = getDaysInMonth(month);
  const prevDaysInMonth = getDaysInMonth(prevMonth);

  // 当月每日支出
  const dailyExpense = new Array(daysInMonth).fill(0);
  transactions.filter(t => t.direction === 'expense').forEach(t => {
    const day = new Date(t.transactionTime).getDate();
    if (day >= 1 && day <= daysInMonth) dailyExpense[day - 1] += t.amount;
  });

  // 上月每日支出
  const prevDailyExpense = new Array(prevDaysInMonth).fill(0);
  prevTransactions.filter(t => t.direction === 'expense').forEach(t => {
    const day = new Date(t.transactionTime).getDate();
    if (day >= 1 && day <= prevDaysInMonth) prevDailyExpense[day - 1] += t.amount;
  });

  // 当月累计
  const cumulative: number[] = [];
  dailyExpense.reduce((sum, val) => { cumulative.push(sum + val); return sum + val; }, 0);

  // 上月累计
  const prevCumulative: number[] = [];
  prevDailyExpense.reduce((sum, val) => { prevCumulative.push(sum + val); return sum + val; }, 0);

  const days = Array.from({ length: Math.max(daysInMonth, prevDaysInMonth) }, (_, i) => `${i + 1}日`);

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ axisValue: string; marker: string; seriesName: string; value?: number }>) => {
        let tip = `<b>${params[0].axisValue}</b><br/>`;
        params.forEach(p => {
          if (p.value != null) {
            tip += `${p.marker} ${p.seriesName}: ¥${p.value.toFixed(2)}<br/>`;
          }
        });
        return tip;
      },
    },
    legend: { data: ['当月累计', '上月累计', '当月日支出'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: days,
      axisLabel: { fontSize: 10, interval: Math.floor(daysInMonth / 7) },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}` },
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
    },
    series: [
      {
        name: '当月累计',
        type: 'line',
        data: cumulative,
        smooth: true,
        lineStyle: { width: 2.5, color: '#2563EB' },
        itemStyle: { color: '#2563EB' },
        areaStyle: { color: 'rgba(37, 99, 235, 0.08)' },
        symbol: 'none',
      },
      {
        name: '上月累计',
        type: 'line',
        data: prevCumulative,
        smooth: true,
        lineStyle: { width: 1.5, type: 'dashed', color: '#9CA3AF' },
        itemStyle: { color: '#9CA3AF' },
        symbol: 'none',
      },
      {
        name: '当月日支出',
        type: 'bar',
        data: dailyExpense.map(v => v > 0 ? Math.round(v * 100) / 100 : null),
        barWidth: 6,
        itemStyle: { color: 'rgba(37, 99, 235, 0.25)', borderRadius: [3, 3, 0, 0] },
      },
    ],
  };
}

// ====== 分类环比条形图 ======

const MAX_COMPARE_CATEGORIES = 8;

export function getCategoryCompareOption(current: CategoryItem[], previous: CategoryItem[]) {
  const prevMap = new Map(previous.map(p => [p.name, p.amount]));
  const categories = current.slice(0, MAX_COMPARE_CATEGORIES);
  const names = categories.map(c => c.name).reverse();
  const currentData = categories.map(c => Math.round(c.amount * 100) / 100).reverse();
  const prevData = categories.map(c => Math.round((prevMap.get(c.name) || 0) * 100) / 100).reverse();

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ axisValue: string; marker: string; seriesName: string; value: number }>) => {
        let tip = `<b>${params[0].axisValue}</b><br/>`;
        params.forEach(p => {
          tip += `${p.marker} ${p.seriesName}: ¥${p.value.toFixed(2)}<br/>`;
        });
        return tip;
      },
    },
    legend: { data: ['本月', '上月'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 80, right: 20, top: 10, bottom: 40 },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        name: '本月',
        type: 'bar',
        barWidth: 10,
        barGap: '30%',
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: (params: { dataIndex: number }) => {
            return CATEGORY_COLORS[names[params.dataIndex] as CategoryType] || '#3B82F6';
          },
        },
        data: currentData,
      },
      {
        name: '上月',
        type: 'bar',
        barWidth: 10,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: 'rgba(156, 163, 175, 0.4)',
        },
        data: prevData,
      },
    ],
  };
}
