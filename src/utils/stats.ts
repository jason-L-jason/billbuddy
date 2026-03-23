import { Transaction, CATEGORY_COLORS, CategoryType } from '@/types';

// ====== 数据类型 ======

export interface CategoryItem {
  name: CategoryType;
  amount: number;
  count: number;
}

export interface Stats {
  totalExpense: number;
  totalIncome: number;
  totalCount: number;
  dailyAvg: number;
  classifiedRate: number;
  unclassifiedCount: number;
  categoryBreakdown: CategoryItem[];
  topCategory: CategoryItem | null;
  topExpenses: Transaction[];
}

// ====== 核心统计 ======

export function computeStats(transactions: Transaction[]): Stats {
  const expenses = transactions.filter((t) => t.direction === 'expense');
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.direction === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const unclassifiedCount = expenses.filter((t) => t.category === '未分类').length;
  const classifiedRate = expenses.length > 0
    ? (expenses.length - unclassifiedCount) / expenses.length
    : 1;

  // 按分类汇总
  const catMap = new Map<CategoryType, { amount: number; count: number }>();
  for (const t of expenses) {
    if (t.category === '未分类') continue;
    const prev = catMap.get(t.category) || { amount: 0, count: 0 };
    catMap.set(t.category, {
      amount: prev.amount + t.amount,
      count: prev.count + 1,
    });
  }

  const categoryBreakdown: CategoryItem[] = Array.from(catMap.entries())
    .map(([name, data]) => ({ name, amount: data.amount, count: data.count }))
    .sort((a, b) => b.amount - a.amount);

  // 日均
  const daysInMonth = transactions.length > 0
    ? new Set(transactions.map((t) => t.transactionTime.slice(0, 10))).size
    : 1;
  const dailyAvg = totalExpense / Math.max(daysInMonth, 1);

  // Top 5
  const topExpenses = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

  return {
    totalExpense,
    totalIncome,
    totalCount: transactions.length,
    dailyAvg,
    classifiedRate,
    unclassifiedCount,
    categoryBreakdown,
    topCategory: categoryBreakdown[0] || null,
    topExpenses,
  };
}

// ====== ECharts 配置 ======

export function getPieOption(data: CategoryItem[]) {
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)',
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 12 },
      emphasis: {
        scaleSize: 8,
        label: { fontSize: 14, fontWeight: 'bold' },
      },
      cursor: 'pointer',
      data: data.map((item) => ({
        name: item.name,
        value: Math.round(item.amount * 100) / 100,
        itemStyle: { color: CATEGORY_COLORS[item.name] },
      })),
    }],
  };
}

export function getBarOption(data: CategoryItem[]) {
  const sorted = [...data].reverse();
  return {
    tooltip: { trigger: 'axis', formatter: '{b}: ¥{c}' },
    grid: { left: 80, right: 20, top: 10, bottom: 20 },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: sorted.map((d) => d.name),
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      barWidth: 16,
      cursor: 'pointer',
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: (params: { dataIndex: number }) => {
          return CATEGORY_COLORS[sorted[params.dataIndex].name] || '#9CA3AF';
        },
      },
      data: sorted.map((d) => Math.round(d.amount * 100) / 100),
    }],
  };
}

// ====== 环比计算 ======

export interface ChangeResult {
  value: number;
  percent: string;
  direction: 'up' | 'down' | 'flat';
}

export function calcChange(current: number, previous: number): ChangeResult {
  if (previous === 0) return {
    value: current,
    percent: current > 0 ? '+∞' : '0%',
    direction: current > 0 ? 'up' : 'flat',
  };
  const diff = current - previous;
  const pct = (diff / previous) * 100;
  return {
    value: diff,
    direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat',
    percent: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
  };
}
