import React, { useEffect, useMemo, useState } from 'react';
import { Card } from 'tdesign-react';
import { ChevronLeftIcon, ChevronRightIcon } from 'tdesign-icons-react';
import ReactECharts from 'echarts-for-react';
import { useTransactionsStore } from '@/store/transactions';
import { Transaction, CATEGORY_COLORS } from '@/types';
import { formatAmount, formatMonth } from '@/utils/format';
import { getTransactionsByMonthStr } from '@/db';
import { computeStats, calcChange, type ChangeResult } from '@/utils/stats';
import { getPrevMonth } from '@/utils/month';
import { getDailyTrendOption, getCategoryCompareOption } from '@/utils/chartOptions';
import { getPieOption } from '@/utils/stats';

// ====== 阈值常量 ======
const INSIGHT_CHANGE_THRESHOLD = 30;
const INSIGHT_NEW_CATEGORY_MIN = 100;
const TOP_EXPENSES_COUNT = 5;

// ====== 主组件 ======

const MonthlyReport: React.FC = () => {
  const { selectedMonth, availableMonths, setSelectedMonth } = useTransactionsStore();
  const [currentTxns, setCurrentTxns] = useState<Transaction[]>([]);
  const [prevTxns, setPrevTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const prevMonth = getPrevMonth(selectedMonth);

  // 加载当月和上月数据
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getTransactionsByMonthStr(selectedMonth),
      getTransactionsByMonthStr(prevMonth),
    ]).then(([curr, prev]) => {
      if (!cancelled) {
        setCurrentTxns(curr);
        setPrevTxns(prev);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedMonth, prevMonth]);

  const stats = useMemo(() => computeStats(currentTxns), [currentTxns]);
  const prevStats = useMemo(() => computeStats(prevTxns), [prevTxns]);

  const expenseChange = useMemo(() => calcChange(stats.totalExpense, prevStats.totalExpense), [stats, prevStats]);
  const incomeChange = useMemo(() => calcChange(stats.totalIncome, prevStats.totalIncome), [stats, prevStats]);
  const dailyAvgChange = useMemo(() => calcChange(stats.dailyAvg, prevStats.dailyAvg), [stats, prevStats]);
  const countChange = useMemo(() => calcChange(stats.totalCount, prevStats.totalCount), [stats, prevStats]);

  // 月份导航
  const canGoNext = availableMonths.indexOf(selectedMonth) > 0;
  const canGoPrev = availableMonths.indexOf(selectedMonth) < availableMonths.length - 1 || !availableMonths.includes(prevMonth);

  const goToPrevMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx < availableMonths.length - 1) setSelectedMonth(availableMonths[idx + 1]);
  };
  const goToNextMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx > 0) setSelectedMonth(availableMonths[idx - 1]);
  };

  // Top 5 大额支出
  const top5 = useMemo(() => {
    return [...currentTxns]
      .filter(t => t.direction === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_EXPENSES_COUNT);
  }, [currentTxns]);

  // 分类变化洞察
  const insights = useMemo(() => {
    const results: string[] = [];
    const prevMap = new Map(prevStats.categoryBreakdown.map(c => [c.name, c.amount]));

    for (const cat of stats.categoryBreakdown.slice(0, 5)) {
      const prev = prevMap.get(cat.name) || 0;
      if (prev === 0) continue;
      const change = ((cat.amount - prev) / prev) * 100;
      if (change > INSIGHT_CHANGE_THRESHOLD) {
        results.push(`${cat.name}支出增长了 ${change.toFixed(0)}%，从 ${formatAmount(prev)} 涨到 ${formatAmount(cat.amount)}`);
      } else if (change < -INSIGHT_CHANGE_THRESHOLD) {
        results.push(`${cat.name}支出减少了 ${Math.abs(change).toFixed(0)}%，从 ${formatAmount(prev)} 降到 ${formatAmount(cat.amount)}`);
      }
    }

    for (const cat of stats.categoryBreakdown) {
      if (!prevMap.has(cat.name) && cat.amount > INSIGHT_NEW_CATEGORY_MIN) {
        results.push(`新增了「${cat.name}」消费，共 ${formatAmount(cat.amount)}`);
      }
    }

    return results;
  }, [stats, prevStats]);

  if (loading) {
    return (
      <div className="animate-fade-in-up space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-card animate-pulse">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-3" />
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-28" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-card animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
          <div className="h-[280px] bg-gray-100 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (currentTxns.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card p-12 text-center">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-gray-700 dark:text-gray-300 text-lg font-medium mb-1">
            {formatMonth(selectedMonth)} 暂无数据
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">导入账单后，消费报告将在这里展示</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* 月份标题 + 导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPrevMonth}
            disabled={!canGoPrev}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeftIcon size="18px" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatMonth(selectedMonth)} 消费报告
          </h2>
          <button
            onClick={goToNextMonth}
            disabled={!canGoNext}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRightIcon size="18px" />
          </button>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          共 {stats.totalCount} 笔交易 · 环比 {formatMonth(prevMonth)}
        </span>
      </div>

      {/* 四项核心指标 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard title="总支出" value={formatAmount(stats.totalExpense)} change={expenseChange} valueColor="text-gray-900 dark:text-gray-100" changeInverted />
        <SummaryCard title="总收入" value={formatAmount(stats.totalIncome)} change={incomeChange} valueColor="text-success" />
        <SummaryCard title="日均消费" value={formatAmount(stats.dailyAvg)} change={dailyAvgChange} valueColor="text-gray-700 dark:text-gray-300" changeInverted />
        <SummaryCard title="交易笔数" value={`${stats.totalCount} 笔`} change={countChange} valueColor="text-gray-700 dark:text-gray-300" />
      </div>

      {/* 智能洞察 */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            💡 消费洞察
          </h3>
          {insights.map((text, i) => (
            <p key={i} className="text-sm text-gray-600 dark:text-gray-400 pl-5">• {text}</p>
          ))}
        </div>
      )}

      {/* 每日消费趋势 */}
      <Card className="shadow-card rounded-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">每日消费趋势</h3>
        <ReactECharts
          option={getDailyTrendOption(currentTxns, prevTxns, selectedMonth, prevMonth)}
          style={{ height: 300 }}
        />
      </Card>

      {/* 分类占比 + 分类环比 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-card rounded-xl">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">分类占比</h3>
          <ReactECharts option={getPieOption(stats.categoryBreakdown)} style={{ height: 300 }} />
        </Card>
        <Card className="shadow-card rounded-xl">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">分类环比对比</h3>
          <ReactECharts option={getCategoryCompareOption(stats.categoryBreakdown, prevStats.categoryBreakdown)} style={{ height: 300 }} />
        </Card>
      </div>

      {/* 分类明细表 */}
      <Card className="shadow-card rounded-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">分类明细</h3>
        <div className="space-y-1.5">
          {stats.categoryBreakdown.map(cat => {
            const prevAmount = prevStats.categoryBreakdown.find(p => p.name === cat.name)?.amount || 0;
            const change = calcChange(cat.amount, prevAmount);
            const pct = stats.totalExpense > 0 ? (cat.amount / stats.totalExpense * 100).toFixed(1) : '0';
            return (
              <div key={cat.name} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.name] }} />
                <span className="text-sm text-gray-900 dark:text-gray-100 w-20">{cat.name}</span>
                <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(parseFloat(pct), 100)}%`, backgroundColor: CATEGORY_COLORS[cat.name], opacity: 0.7 }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-300">{pct}%</span>
                </div>
                <span className="amount-text text-sm font-semibold text-gray-900 dark:text-gray-100 w-24 text-right">{formatAmount(cat.amount)}</span>
                <span className="text-xs text-gray-400 w-12 text-right">{cat.count} 笔</span>
                <ChangeTag change={change} inverted size="sm" />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top 5 大额支出 */}
      <Card className="shadow-card rounded-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Top 5 大额支出</h3>
        <div className="space-y-1">
          {top5.map((t, i) => (
            <div key={t.id || i} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center font-medium">{i + 1}</span>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[t.category] }} />
              <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">
                {t.counterparty}
                {t.description && t.description !== t.counterparty && (
                  <span className="text-gray-400 dark:text-gray-500 ml-1">- {t.description}</span>
                )}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(t.transactionTime).getMonth() + 1}/{new Date(t.transactionTime).getDate()}
              </span>
              <span className="amount-text font-semibold text-gray-900 dark:text-gray-100">{formatAmount(t.amount)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 底部信息 */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500 pb-4">
        <span>📊</span>
        <span>报告基于 {stats.totalCount} 笔交易自动生成 · {formatMonth(selectedMonth)}</span>
      </div>
    </div>
  );
};

// ====== 子组件 ======

const SummaryCard: React.FC<{
  title: string;
  value: string;
  change: ChangeResult;
  valueColor: string;
  changeInverted?: boolean;
}> = ({ title, value, change, valueColor, changeInverted }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-card">
    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
    <p className={`text-lg sm:text-2xl font-bold amount-text ${valueColor}`}>{value}</p>
    <ChangeTag change={change} inverted={changeInverted} />
  </div>
);

const ChangeTag: React.FC<{
  change: { percent: string; direction: 'up' | 'down' | 'flat' };
  inverted?: boolean;
  size?: 'sm' | 'md';
}> = ({ change, inverted, size = 'md' }) => {
  const isGood = inverted ? change.direction === 'down' : change.direction === 'up';
  const isBad = inverted ? change.direction === 'up' : change.direction === 'down';

  const colorClass = isGood ? 'text-success' : isBad ? 'text-danger' : 'text-gray-400 dark:text-gray-500';
  const arrow = change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : '→';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span className={`${textSize} ${colorClass} mt-0.5 inline-flex items-center gap-0.5 whitespace-nowrap`}>
      {arrow} {change.percent}
    </span>
  );
};

export default MonthlyReport;
