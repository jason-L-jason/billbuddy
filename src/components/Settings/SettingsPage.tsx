import React, { useState, useEffect } from 'react';
import { Card, Button, Popconfirm, MessagePlugin, Switch } from 'tdesign-react';
import { DeleteIcon, DownloadIcon } from 'tdesign-icons-react';
import { db, clearAllData } from '@/db';
import { useThemeStore } from '@/store/theme';
import { useTransactionsStore } from '@/store/transactions';

const SettingsPage: React.FC = () => {
  const { isDark, toggle } = useThemeStore();
  const { loadTransactions, loadAvailableMonths } = useTransactionsStore();
  const [stats, setStats] = useState({ transactions: 0, taobaoOrders: 0, jdOrders: 0, importRecords: 0 });

  useEffect(() => {
    Promise.all([
      db.transactions.count(),
      db.taobaoOrders.count(),
      db.jdOrders.count(),
      db.importRecords.count(),
    ]).then(([transactions, taobaoOrders, jdOrders, importRecords]) => {
      setStats({ transactions, taobaoOrders, jdOrders, importRecords });
    });
  }, []);

  const handleClearAll = async () => {
    await clearAllData();
    setStats({ transactions: 0, taobaoOrders: 0, jdOrders: 0, importRecords: 0 });
    await loadAvailableMonths();
    await loadTransactions();
    MessagePlugin.success('所有数据已清除');
  };

  const handleExportAll = async () => {
    try {
      const [transactions, taobaoOrders, jdOrders, importRecords, customRules] = await Promise.all([
        db.transactions.toArray(),
        db.taobaoOrders.toArray(),
        db.jdOrders.toArray(),
        db.importRecords.toArray(),
        db.customRules.toArray(),
      ]);

      const data = {
        version: 1,
        exportTime: new Date().toISOString(),
        transactions,
        taobaoOrders,
        jdOrders,
        importRecords,
        customRules,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BillBuddy_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      MessagePlugin.success('数据已导出');
    } catch (e) {
      console.error('导出失败:', e);
      MessagePlugin.error('导出失败');
    }
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.version || !data.transactions) {
          MessagePlugin.error('无效的备份文件');
          return;
        }

        // 清除现有数据
        await clearAllData();

        // 导入数据
        if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
        if (data.taobaoOrders?.length) await db.taobaoOrders.bulkAdd(data.taobaoOrders);
        if (data.jdOrders?.length) await db.jdOrders.bulkAdd(data.jdOrders);
        if (data.importRecords?.length) await db.importRecords.bulkAdd(data.importRecords);
        if (data.customRules?.length) await db.customRules.bulkAdd(data.customRules);

        // 刷新
        const [transactions, taobaoOrders, jdOrders, importRecords] = await Promise.all([
          db.transactions.count(),
          db.taobaoOrders.count(),
          db.jdOrders.count(),
          db.importRecords.count(),
        ]);
        setStats({ transactions, taobaoOrders, jdOrders, importRecords });
        await loadAvailableMonths();
        await loadTransactions();

        MessagePlugin.success(`恢复成功：${transactions} 笔交易`);
      } catch (e) {
        console.error('恢复失败:', e);
        MessagePlugin.error('恢复失败，请检查文件格式');
      }
    };
    input.click();
  };

  return (
    <div className="animate-fade-in-up space-y-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">设置</h2>

      {/* 外观 */}
      <Card className="shadow-card rounded-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">外观</h3>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">暗色模式</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">切换深色/浅色主题</p>
          </div>
          <Switch value={isDark} onChange={toggle} />
        </div>
      </Card>

      {/* 数据管理 */}
      <Card className="shadow-card rounded-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">数据管理</h3>

        {/* 数据统计 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatItem label="交易记录" value={stats.transactions} />
          <StatItem label="淘宝订单" value={stats.taobaoOrders} />
          <StatItem label="京东订单" value={stats.jdOrders} />
          <StatItem label="导入批次" value={stats.importRecords} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">导出备份</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">将所有数据导出为 JSON 文件</p>
            </div>
            <Button variant="outline" onClick={handleExportAll} disabled={stats.transactions === 0}>
              <DownloadIcon className="mr-1" />
              导出
            </Button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">恢复备份</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">从 JSON 备份文件恢复数据（会覆盖现有数据）</p>
            </div>
            <Button variant="outline" onClick={handleImportBackup}>
              恢复
            </Button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-danger">清除所有数据</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">删除所有交易记录、订单和导入历史</p>
            </div>
            <Popconfirm
              content="确定要清除所有数据吗？此操作不可恢复，建议先导出备份。"
              onConfirm={handleClearAll}
            >
              <Button variant="outline" theme="danger" disabled={stats.transactions === 0}>
                <DeleteIcon className="mr-1" />
                清除
              </Button>
            </Popconfirm>
          </div>
        </div>
      </Card>

      {/* 关于 */}
      <Card className="shadow-card rounded-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">关于</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">应用名称</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">BillBuddy</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">版本</span>
            <span className="text-gray-900 dark:text-gray-100">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">数据存储</span>
            <span className="text-gray-900 dark:text-gray-100">浏览器本地（IndexedDB）</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">支持格式</span>
            <span className="text-gray-900 dark:text-gray-100">微信 / 支付宝 / 淘宝 / 京东</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            🔒 所有数据仅存储在你的设备上，不会上传到任何服务器
          </p>
        </div>
      </Card>
    </div>
  );
};

const StatItem: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
    <p className="text-lg font-bold text-gray-900 dark:text-gray-100 amount-text">{value.toLocaleString()}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
  </div>
);

export default SettingsPage;
