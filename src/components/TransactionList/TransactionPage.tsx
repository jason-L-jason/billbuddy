import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Input, Select, Alert, Button, Tag, Popconfirm, MessagePlugin } from 'tdesign-react';
import { SearchIcon, DownloadIcon, DeleteIcon, RefreshIcon, ChevronDownIcon, ChevronUpIcon, LinkIcon } from 'tdesign-icons-react';
import { useTransactionsStore } from '@/store/transactions';
import { Transaction, ALL_CATEGORIES, CATEGORY_COLORS, CategoryType } from '@/types';
import { formatAmount, formatDate } from '@/utils/format';
import { db } from '@/db';
import { orderMatcher } from '@/core/matcher';
import CategoryBadge from './CategoryBadge';

const TransactionPage: React.FC = () => {
  const { transactions, isLoading, loadTransactions, selectedMonth, reclassifyAll } = useTransactionsStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>(
    searchParams.get('category') || 'all'
  );
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterMatch, setFilterMatch] = useState<string>('all');
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [isMatching, setIsMatching] = useState(false);

  // URL 参数变化时同步筛选条件
  useEffect(() => {
    const urlCategory = searchParams.get('category');
    if (urlCategory) {
      setFilterCategory(urlCategory);
    }
  }, [searchParams]);

  // 当用户手动切换筛选时，清除 URL 参数
  const handleCategoryFilterChange = (value: string) => {
    setFilterCategory(value);
    if (searchParams.has('category')) {
      searchParams.delete('category');
      setSearchParams(searchParams, { replace: true });
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, selectedMonth]);

  // 筛选
  const filtered = transactions.filter((t) => {
    if (searchText) {
      const text = searchText.toLowerCase();
      if (
        !t.counterparty.toLowerCase().includes(text) &&
        !t.description.toLowerCase().includes(text) &&
        !(t.ecommerceMatch?.items.some((item) => item.name.toLowerCase().includes(text)))
      ) {
        return false;
      }
    }
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (filterDirection !== 'all' && t.direction !== filterDirection) return false;
    if (filterMatch === 'matched' && !t.ecommerceMatch) return false;
    if (filterMatch === 'unmatched') {
      const text = `${t.counterparty} ${t.description}`.toLowerCase();
      if (t.ecommerceMatch || !(text.includes('淘宝') || text.includes('taobao'))) return false;
    }
    return true;
  });

  const unclassifiedCount = transactions.filter((t) => t.category === '未分类').length;
  const expenseCount = transactions.filter((t) => t.direction === 'expense').length;
  const matchedCount = transactions.filter((t) => t.ecommerceMatch).length;

  const handleCategoryChange = async (txn: Transaction, newCategory: CategoryType) => {
    if (!txn.id) return;
    await db.transactions.update(txn.id, {
      category: newCategory,
      classifySource: 'manual',
      classifyConfidence: 1.0,
      classifyReason: '用户手动分类',
    });
    loadTransactions();
    MessagePlugin.success('分类已更新');
  };

  const handleRunMatch = async () => {
    setIsMatching(true);
    try {
      const stats = await orderMatcher.matchAll();
      if (stats.updatedCount > 0) {
        MessagePlugin.success(
          `匹配完成：精确 ${stats.exactMatches} 笔 + 模糊 ${stats.fuzzyMatches} 笔（本次新增 ${stats.updatedCount} 笔）`
        );
        loadTransactions();
      } else if (stats.exactMatches + stats.fuzzyMatches > 0) {
        MessagePlugin.info(`所有可匹配交易已匹配完毕（共 ${stats.exactMatches + stats.fuzzyMatches} 笔）`);
      } else {
        MessagePlugin.info('未找到可匹配的淘宝订单，请先上传淘宝订单 Excel');
      }
    } catch (e) {
      console.error('匹配失败:', e);
      MessagePlugin.error('匹配失败');
    } finally {
      setIsMatching(false);
    }
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      MessagePlugin.warning('没有数据可导出');
      return;
    }

    const headers = ['交易时间', '平台', '交易对方', '商品说明', '收/支', '金额', '分类', '分类来源', '匹配状态', '淘宝商品'];
    const rows = filtered.map((t) => [
      t.transactionTime,
      t.platform === 'wechat' ? '微信' : '支付宝',
      t.counterparty,
      t.description,
      t.direction === 'expense' ? '支出' : t.direction === 'income' ? '收入' : '其他',
      t.amount.toFixed(2),
      t.category,
      t.classifySource === 'rule' ? '规则' : t.classifySource === 'manual' ? '手动' : 'AI',
      t.ecommerceMatch ? '已匹配' : '',
      t.ecommerceMatch ? t.ecommerceMatch.items.map((i) => `${i.name}×${i.quantity}`).join('; ') : '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BillBuddy_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    MessagePlugin.success('导出成功');
  };

  const handleClearData = async () => {
    await db.transactions.clear();
    await db.importRecords.clear();
    await db.taobaoOrders.clear();
    loadTransactions();
    MessagePlugin.success('数据已清除');
  };

  const handleReclassify = async () => {
    setIsReclassifying(true);
    try {
      const { updated, total } = await reclassifyAll();
      if (updated > 0) {
        MessagePlugin.success(`重新分类完成：${total} 笔交易中有 ${updated} 笔分类已更新`);
      } else {
        MessagePlugin.info('所有交易分类未变化');
      }
    } catch (e) {
      console.error('重新分类失败:', e);
      MessagePlugin.error('重新分类失败');
    } finally {
      setIsReclassifying(false);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-4">
      {/* Loading 骨架屏 */}
      {isLoading && transactions.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-r-md p-4 shadow-card animate-pulse flex gap-4">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-12" />
              <div className="h-4 bg-gray-200 rounded w-32 flex-1" />
              <div className="h-4 bg-gray-200 rounded w-16" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      )}

      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          prefixIcon={<SearchIcon />}
          placeholder="搜索交易对方、商品或淘宝商品名"
          value={searchText}
          onChange={(v) => setSearchText(v as string)}
          style={{ width: 280 }}
          clearable
        />
        <Select
          value={filterCategory}
          onChange={(v) => handleCategoryFilterChange(v as string)}
          style={{ width: 140 }}
          options={[
            { label: '全部分类', value: 'all' },
            ...ALL_CATEGORIES.map((c) => ({ label: c, value: c })),
          ]}
        />
        <Select
          value={filterDirection}
          onChange={(v) => setFilterDirection(v as string)}
          style={{ width: 120 }}
          options={[
            { label: '全部', value: 'all' },
            { label: '支出', value: 'expense' },
            { label: '收入', value: 'income' },
          ]}
        />
        <Select
          value={filterMatch}
          onChange={(v) => setFilterMatch(v as string)}
          style={{ width: 140 }}
          options={[
            { label: '全部匹配', value: 'all' },
            { label: '🔗 已匹配', value: 'matched' },
            { label: '❓ 未匹配', value: 'unmatched' },
          ]}
        />

        <div className="flex-1" />

        <Button
          variant="outline"
          onClick={handleRunMatch}
          loading={isMatching}
          disabled={isMatching || transactions.length === 0}
        >
          <LinkIcon className="mr-1" />
          {isMatching ? '匹配中...' : '重新匹配'}
        </Button>
        <Button
          variant="outline"
          onClick={handleReclassify}
          loading={isReclassifying}
          disabled={isReclassifying || transactions.length === 0}
        >
          <RefreshIcon className="mr-1" />
          {isReclassifying ? '分类中...' : '重新分类'}
        </Button>
        <Button variant="outline" onClick={handleExportCSV}>
          <DownloadIcon className="mr-1" />
          导出 CSV
        </Button>
        <Popconfirm
          content="确定要清除所有数据吗？此操作不可恢复。"
          onConfirm={handleClearData}
        >
          <Button variant="outline" theme="danger">
            <DeleteIcon className="mr-1" />
            清除数据
          </Button>
        </Popconfirm>
      </div>

      {/* 未分类提醒 */}
      {unclassifiedCount > 0 && (
        <Alert
          theme="warning"
          message={`${unclassifiedCount} 笔交易尚未分类，点击分类标签即可修改`}
        />
      )}

      {/* 统计信息 */}
      <div className="text-sm text-gray-500">
        共 {filtered.length} 笔交易（支出 {expenseCount} 笔）
        {matchedCount > 0 && <span className="ml-2">· 🔗 {matchedCount} 笔已匹配淘宝订单</span>}
      </div>

      {/* 交易列表 */}
      {filtered.length === 0 ? (
        <EmptyState hasAnyData={transactions.length > 0} />
      ) : (
        <div className="bg-white rounded-r-md shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-gray-100 text-gray-500 text-left">
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">平台</th>
                <th className="px-4 py-3 font-medium">交易对方</th>
                <th className="px-4 py-3 font-medium">商品说明</th>
                <th className="px-4 py-3 font-medium text-right">金额</th>
                <th className="px-4 py-3 font-medium">分类</th>
                <th className="px-4 py-3 font-medium">来源</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  transaction={txn}
                  onCategoryChange={handleCategoryChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// 单行组件（支持展开淘宝商品明细）
const TransactionRow: React.FC<{
  transaction: Transaction;
  onCategoryChange: (txn: Transaction, cat: CategoryType) => void;
}> = ({ transaction: txn, onCategoryChange }) => {
  const [expanded, setExpanded] = useState(false);
  const isUnclassified = txn.category === '未分类';
  const hasMatch = !!txn.ecommerceMatch;

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-brand-fade transition-colors ${
          isUnclassified ? 'bg-warning-light' : ''
        } ${hasMatch ? 'cursor-pointer' : ''}`}
        onClick={() => hasMatch && setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
          {formatDate(txn.transactionTime)}
        </td>
        <td className="px-4 py-3">
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            txn.platform === 'wechat' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {txn.platform === 'wechat' ? '微信' : '支付宝'}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-900 max-w-[160px] truncate">
          {txn.counterparty}
        </td>
        <td className="px-4 py-3 text-gray-600 max-w-[200px]">
          <div className="flex items-center gap-1">
            <span className="truncate">{txn.description}</span>
            {hasMatch && (
              <span className="flex-shrink-0">
                {expanded ? <ChevronUpIcon size="14px" /> : <ChevronDownIcon size="14px" />}
              </span>
            )}
          </div>
        </td>
        <td className={`px-4 py-3 text-right amount-text font-semibold whitespace-nowrap ${
          txn.direction === 'income' ? 'text-success' : 'text-gray-900'
        }`}>
          {txn.direction === 'income' ? '+' : '-'}{formatAmount(txn.amount)}
        </td>
        <td className="px-4 py-3">
          <CategoryBadge
            category={txn.category}
            onSelect={(cat) => onCategoryChange(txn, cat)}
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Tag
              size="small"
              variant="light"
              theme={txn.classifySource === 'manual' ? 'warning' : 'primary'}
            >
              {txn.classifySource === 'rule' ? '🔧 规则' : txn.classifySource === 'manual' ? '✋ 手动' : '🤖 AI'}
            </Tag>
            {hasMatch && (
              <Tag
                size="small"
                variant="light"
                theme="success"
              >
                {txn.ecommerceMatch!.matchMethod === 'order_id' ? '🔗 精确' : '🔗 模糊'}
              </Tag>
            )}
          </div>
        </td>
      </tr>
      {/* 淘宝商品明细展开行 */}
      {hasMatch && expanded && (
        <tr className="bg-orange-50 border-b border-orange-100">
          <td colSpan={7} className="px-4 py-3">
            <div className="ml-4 space-y-1">
              <div className="flex items-center gap-2 text-xs text-orange-600 font-medium mb-2">
                <span>📦 淘宝订单</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">
                  {txn.ecommerceMatch!.matchMethod === 'order_id'
                    ? `订单号精确匹配 · 置信度 ${(txn.ecommerceMatch!.matchConfidence * 100).toFixed(0)}%`
                    : `金额+时间模糊匹配 · 置信度 ${(txn.ecommerceMatch!.matchConfidence * 100).toFixed(0)}%`
                  }
                </span>
              </div>
              {txn.ecommerceMatch!.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs py-1 px-2 bg-white rounded">
                  <span className="text-gray-900 flex-1">{item.name}</span>
                  {item.shopName && (
                    <span className="text-gray-400">{item.shopName}</span>
                  )}
                  <span className="text-gray-500">×{item.quantity}</span>
                  <span className="text-gray-700 font-medium">¥{item.actualPaid.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// 空状态
const EmptyState: React.FC<{ hasAnyData: boolean }> = ({ hasAnyData }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-r-md shadow-card p-12 text-center">
      <p className="text-4xl mb-4">{hasAnyData ? '🔍' : '📋'}</p>
      <p className="text-gray-700 font-medium mb-1">
        {hasAnyData ? '没有找到匹配的交易' : '还没有交易数据'}
      </p>
      <p className="text-gray-400 text-sm mb-6">
        {hasAnyData ? '试试调整筛选条件或搜索关键词' : '导入微信或支付宝账单，开始记录你的消费'}
      </p>
      {!hasAnyData && (
        <Button theme="primary" onClick={() => navigate('/')}>
          去导入账单
        </Button>
      )}
    </div>
  );
};

export default TransactionPage;
