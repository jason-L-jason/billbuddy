import React, { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Alert, Button } from 'tdesign-react';
import ReactECharts from 'echarts-for-react';
import { useTransactionsStore } from '@/store/transactions';
import { CATEGORY_COLORS } from '@/types';
import { formatAmount, formatMonth } from '@/utils/format';
import { computeStats, getPieOption, getBarOption } from '@/utils/stats';

// 统计卡片（公共组件）
export const StatCard: React.FC<{
  title: string;
  value: string;
  color: string;
  subtitle?: string;
}> = ({ title, value, color, subtitle }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-card card-hover">
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
    <p className={`text-2xl font-bold amount-text ${color}`}>{value}</p>
    {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
  </div>
);

const DashboardPage: React.FC = () => {
  const { transactions, isLoading, loadTransactions, selectedMonth } = useTransactionsStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, selectedMonth]);

  const stats = useMemo(() => computeStats(transactions), [transactions]);

  const goToCategory = useCallback((category: string) => {
    navigate(`/transactions?category=${encodeURIComponent(category)}`);
  }, [navigate]);

  // Loading 骨架屏
  if (isLoading) {
    return (
      <div className="animate-fade-in-up space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-card animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-card animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-4" />
              <div className="h-[260px] bg-gray-100 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 空状态
  if (transactions.length === 0) {
    return (
      <div className="animate-fade-in-up bg-white dark:bg-gray-800 rounded-xl shadow-card p-12 text-center">
        <p className="text-5xl mb-4">📊</p>
        <p className="text-gray-700 dark:text-gray-300 text-lg font-medium mb-1">
          {formatMonth(selectedMonth)} 暂无数据
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">导入账单后，消费洞察一目了然</p>
        <Button theme="primary" onClick={() => navigate('/')}>
          去导入账单
        </Button>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="本月总支出"
          value={formatAmount(stats.totalExpense)}
          color="text-gray-900 dark:text-gray-100"
        />
        <StatCard
          title="日均消费"
          value={formatAmount(stats.dailyAvg)}
          color="text-gray-700 dark:text-gray-300"
        />
        <StatCard
          title="已分类率"
          value={`${(stats.classifiedRate * 100).toFixed(0)}%`}
          color={stats.classifiedRate >= 0.9 ? 'text-success' : 'text-warning'}
          subtitle={`${stats.totalCount} 笔交易`}
        />
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-card rounded-xl">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">分类占比</h3>
          <ReactECharts
            option={getPieOption(stats.categoryBreakdown)}
            style={{ height: 300 }}
            onEvents={{
              click: (params: { name: string }) => {
                if (params.name) goToCategory(params.name);
              },
            }}
          />
        </Card>

        <Card className="shadow-card rounded-xl">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">分类排行</h3>
          <ReactECharts
            option={getBarOption(stats.categoryBreakdown)}
            style={{ height: 300 }}
            onEvents={{
              click: (params: { name: string }) => {
                if (params.name) goToCategory(params.name);
              },
            }}
          />
        </Card>
      </div>

      {/* Top 5 大额支出 */}
      <Card className="shadow-card rounded-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Top 5 大额支出</h3>
        <div className="space-y-3">
          {stats.topExpenses.map((t, i) => (
            <div
              key={t.id || i}
              className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => goToCategory(t.category)}
            >
              <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[t.category] }}
              />
              <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                {t.counterparty}
                {t.description && t.description !== t.counterparty && (
                  <span className="text-gray-400 dark:text-gray-500 ml-1">- {t.description}</span>
                )}
              </span>
              <span className="amount-text font-semibold text-gray-900 dark:text-gray-100">
                {formatAmount(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
