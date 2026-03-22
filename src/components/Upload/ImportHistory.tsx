import React, { useEffect } from 'react';
import { useTransactionsStore } from '@/store/transactions';

const ImportHistory: React.FC = () => {
  const { importRecords, loadImportRecords } = useTransactionsStore();

  useEffect(() => {
    loadImportRecords();
  }, [loadImportRecords]);

  if (importRecords.length === 0) return null;

  return (
    <div className="bg-white rounded-r-md p-6 shadow-card">
      <h3 className="text-base font-semibold text-gray-900 mb-4">最近导入记录</h3>
      <div className="space-y-2">
        {importRecords.slice(0, 10).map((record) => (
          <div
            key={record.id}
            className="flex items-center gap-3 py-2 px-3 rounded-r-sm hover:bg-gray-50 transition-colors"
          >
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              record.platform === 'wechat'
                ? 'bg-green-100 text-green-700'
                : record.platform === 'alipay'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {record.platform === 'wechat' ? '微信' : record.platform === 'alipay' ? '支付宝' : '淘宝'}
            </span>
            <span className="text-sm text-gray-700 flex-1">{record.fileName}</span>
            <span className="text-xs text-gray-400">{record.recordCount} 笔</span>
            {record.dateRange && (
              <span className="text-xs text-gray-400">{record.dateRange}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImportHistory;
