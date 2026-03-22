import React, { useEffect, useMemo } from 'react';
import { Card, Alert } from 'tdesign-react';
import ReactECharts from 'echarts-for-react';
import { useTransactionsStore } from '@/store/transactions';
import { Transaction, CATEGORY_COLORS, CategoryType } from '@/types';
import { formatAmount, formatMonth } from '@/utils/format';

const DashboardPage: React.FC = () => {
  const { transactions, isLoading, loadTransactions, selectedMonth } = useTransactionsStore();

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, selectedMonth]);

  const stats = useMemo(() => computeStats(transactions), [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="animate-fade-in-up bg-white rounded-r-md shadow-card p-12 text-center">
        <p className="text-5xl mb-4">📊</p>
        <p className="text-gray-500 text-lg">
          {formatMonth(selectedMonth)} 没有数据
        </p>
        <p className="text-gray-400 mt-1">试试导入账单？</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* 洞察 Banner */}
      {stats.topCategory && (
        <Alert
          theme="info"
          message={
            <span>
              💡 本月最大支出：
              <strong>{stats.topCategory.name}</strong>
              （{formatAmount(stats.topCategory.amount)}，占比{' '}
              {((stats.topCategory.amount / stats.totalExpense) * 100).toFixed(1)}%）
              {stats.classifiedRate < 1 && (
                <span className="ml-2 text-warning">
                  · {stats.unclassifiedCount} 笔待分类
                </span>
              )}
            </span>
          }
        />
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="本月总支出"
          value={formatAmount(stats.totalExpense)}
          color="text-gray-900"
        />
        <StatCard
          title="日均消费"
          value={formatAmount(stats.dailyAvg)}
          color="text-gray-700"
        />
        <StatCard
          title="已分类率"
          value={`${(stats.classifiedRate * 100).toFixed(0)}%`}
          color={stats.classifiedRate >= 0.9 ? 'text-success' : 'text-warning'}
          subtitle={`${stats.totalCount} 笔交易`}
        />
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 饼图 */}
        <Card className="shadow-card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">分类占比</h3>
          <ReactECharts option={getPieOption(stats.categoryBreakdown)} style={{ height: 300 }} />
        </Card>

        {/* 条形图 */}
        <Card className="shadow-card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">分类排行</h3>
          <ReactECharts option={getBarOption(stats.categoryBreakdown)} style={{ height: 300 }} />
        </Card>
      </div>

      {/* Top 5 大额支出 */}
      <Card className="shadow-card">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Top 5 大额支出</h3>
        <div className="space-y-3">
          {stats.topExpenses.map((t, i) => (
            <div key={t.id || i} className="flex items-center gap-3 py-2">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[t.category] }}
              />
              <span className="text-sm text-gray-900 flex-1">
                {t.counterparty}
                {t.description && t.description !== t.counterparty && (
                  <span className="text-gray-400 ml-1">- {t.description}</span>
                )}
              </span>
              <span className="amount-text font-semibold text-gray-900">
                {formatAmount(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// 统计卡片
const StatCard: React.FC<{
  title: string;
  value: string;
  color: string;
  subtitle?: string;
}> = ({ title, value, color, subtitle }) => (
  <div className="bg-white rounded-r-md p-5 shadow-card card-hover">
    <p className="text-sm text-gray-500 mb-1">{title}</p>
    <p className={`text-2xl font-bold amount-text ${color}`}>{value}</p>
    {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
  </div>
);

// ====== 数据计算 ======

interface CategoryItem {
  name: CategoryType;
  amount: number;
  count: number;
}

interface Stats {
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

function computeStats(transactions: Transaction[]): Stats {
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

function getPieOption(data: CategoryItem[]) {
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
      data: data.map((item) => ({
        name: item.name,
        value: Math.round(item.amount * 100) / 100,
        itemStyle: { color: CATEGORY_COLORS[item.name] },
      })),
    }],
  };
}

function getBarOption(data: CategoryItem[]) {
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

export default DashboardPage;
