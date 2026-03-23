import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Alert, Button } from 'tdesign-react';
import { ViewListIcon } from 'tdesign-icons-react';
import ReactECharts from 'echarts-for-react';
import { useTransactionsStore } from '@/store/transactions';
import { CATEGORY_COLORS } from '@/types';
import { formatAmount, formatMonth } from '@/utils/format';
import { computeStats, getPieOption, getBarOption } from '@/utils/stats';
import { StatCard } from '@/components/Dashboard/DashboardPage';
import UploadZone from '@/components/Upload/UploadZone';
import type { ParseSummary } from '@/components/Upload/UploadZone';
import ImportHistory from '@/components/Upload/ImportHistory';

const HomePage: React.FC = () => {
  const { transactions, isLoading, loadTransactions, selectedMonth } = useTransactionsStore();
  const navigate = useNavigate();
  const [importResult, setImportResult] = useState<ParseSummary[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, selectedMonth]);

  const stats = useMemo(() => computeStats(transactions), [transactions]);
  const hasData = transactions.length > 0;

  const goToCategory = useCallback((category: string) => {
    navigate(`/transactions?category=${encodeURIComponent(category)}`);
  }, [navigate]);

  const handleImportComplete = useCallback((summaries: ParseSummary[]) => {
    setImportResult(summaries);
    const totalImported = summaries.reduce((s, r) => s + r.newImported, 0);
    if (totalImported > 0) {
      setTimeout(() => setImportResult(null), 5000);
    }
  }, []);

  // ====== Loading 骨架屏 ======
  if (isLoading && !hasData) {
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

  // ====== 无数据：欢迎引导 + 上传区 ======
  if (!hasData) {
    return (
      <div className="animate-fade-in-up space-y-6">
        {/* 欢迎 Banner */}
        <div className="bg-gradient-to-br from-brand via-blue-600 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">👋 欢迎使用 BillBuddy</h2>
            <p className="text-white/80 text-sm mb-6">
              导入你的微信/支付宝账单，自动分类分析每月消费
            </p>
            <div className="flex flex-wrap gap-8 text-sm">
              {[
                { step: '1', text: '上传账单文件' },
                { step: '2', text: '自动解析分类' },
                { step: '3', text: '查看消费洞察' },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-xs font-bold">
                    {step}
                  </span>
                  <span className="text-white/90">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <UploadZone compact={false} onImportComplete={handleImportComplete} />

        {importResult && importResult.length > 0 && (
          <ImportResultCard summaries={importResult} />
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>🔒</span>
          <span>数据仅存储在你的浏览器中，不会上传到任何服务器</span>
        </div>

        <ImportHistory />
      </div>
    );
  }

  // ====== 有数据：看板 + 折叠上传区 ======
  return (
    <div className="animate-fade-in-up space-y-6">
      <UploadZone compact={true} onImportComplete={handleImportComplete} />

      {importResult && importResult.length > 0 && (
        <ImportResultCard summaries={importResult} onDismiss={() => setImportResult(null)} />
      )}

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
        <div className="space-y-1">
          {stats.topExpenses.map((t, i) => (
            <div
              key={t.id || i}
              className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => goToCategory(t.category)}
            >
              <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[t.category] }}
              />
              <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">
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

      {/* 快速操作 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
          {showHistory ? '收起导入历史 ▲' : '查看导入历史 ▼'}
        </button>

        <Button
          variant="outline"
          size="small"
          onClick={() => navigate('/transactions')}
        >
          <ViewListIcon className="mr-1" />
          查看全部明细
        </Button>
      </div>

      {showHistory && (
        <div className="animate-fade-in-up">
          <ImportHistory />
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500 pb-4">
        <span>🔒</span>
        <span>数据仅存储在你的浏览器中，不会上传到任何服务器</span>
      </div>
    </div>
  );
};

// ====== 导入结果卡片 ======
const ImportResultCard: React.FC<{
  summaries: ParseSummary[];
  onDismiss?: () => void;
}> = ({ summaries, onDismiss }) => {
  const totalImported = summaries.reduce((s, r) => s + r.newImported, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-card space-y-3 relative animate-fade-in-up">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 w-6 h-6 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-xs cursor-pointer"
        >
          ✕
        </button>
      )}

      <div className="flex items-center gap-2">
        <span className="text-lg">{totalImported > 0 ? '✅' : 'ℹ️'}</span>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {totalImported > 0 ? '导入完成' : '无新增数据'}
        </h3>
      </div>

      {summaries.map((s, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            s.platform === '微信' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : s.platform === '支付宝' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
          }`}>
            {s.platform}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{s.fileName}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            解析 {s.totalParsed} 笔 · 新增 {s.newImported} 笔
            {s.duplicateSkipped > 0 && ` · 重复 ${s.duplicateSkipped} 笔`}
          </span>
        </div>
      ))}

      {summaries.some((s) => s.unclassifiedCount > 0) && (
        <Alert
          theme="warning"
          message={`${summaries.reduce((s, r) => s + r.unclassifiedCount, 0)} 笔交易尚未分类，你可以在明细页点击标签手动分类`}
        />
      )}
    </div>
  );
};

export default HomePage;
