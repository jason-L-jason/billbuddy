import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Alert, MessagePlugin, Progress } from 'tdesign-react';
import { CloudUploadIcon, ChartPieIcon, ViewListIcon } from 'tdesign-icons-react';
import { parseWechatCSV } from '@/core/parser/wechat';
import { parseWechatXLSX } from '@/core/parser/wechat-xlsx';
import { parseAlipayCSV } from '@/core/parser/alipay';
import { parseTaobaoExcel } from '@/core/parser/taobao';
import { detectCSVPlatform, readFileContent, detectByFileName } from '@/core/parser/detector';
import { classifierOrchestrator } from '@/core/classifier/orchestrator';
import { orderMatcher } from '@/core/matcher';
import { db, generateBatchId, isTransactionExists } from '@/db';
import { useTransactionsStore } from '@/store/transactions';
import { Transaction, ImportRecord, TaobaoOrder } from '@/types';
import ImportHistory from './ImportHistory';

interface ParseSummary {
  fileName: string;
  platform: string;
  totalParsed: number;
  newImported: number;
  duplicateSkipped: number;
  classifiedCount: number;
  unclassifiedCount: number;
}

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { loadTransactions, loadImportRecords } = useTransactionsStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [summaries, setSummaries] = useState<ParseSummary[]>([]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setSummaries([]);

    const newSummaries: ParseSummary[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setProgressText(`正在解析 ${file.name}...`);
      setProgress(Math.round(((i) / fileArray.length) * 50));

      const summary = await processFile(file);
      if (summary) {
        newSummaries.push(summary);
      }

      setProgress(Math.round(((i + 1) / fileArray.length) * 100));
    }

    setSummaries(newSummaries);
    setIsProcessing(false);
    setProgressText('');

    const totalImported = newSummaries.reduce((s, r) => s + r.newImported, 0);
    if (totalImported > 0) {
      const hasTaobao = newSummaries.some((s) => s.platform === '淘宝');
      const hasPayment = newSummaries.some((s) => s.platform !== '淘宝');

      // 如果导入了淘宝订单，自动运行匹配
      if (hasTaobao) {
        setProgressText('正在匹配淘宝订单与支付宝交易...');
        try {
          const matchStats = await orderMatcher.matchAll();
          if (matchStats.updatedCount > 0) {
            MessagePlugin.success(
              `成功导入 ${totalImported} 条数据，自动匹配 ${matchStats.exactMatches} 笔精确 + ${matchStats.fuzzyMatches} 笔模糊`
            );
          } else if (!hasPayment) {
            MessagePlugin.success(`成功导入 ${totalImported} 条淘宝订单`);
          } else {
            MessagePlugin.success(`成功导入 ${totalImported} 条数据`);
          }
        } catch (e) {
          console.error('匹配失败:', e);
          MessagePlugin.success(`成功导入 ${totalImported} 条数据（匹配过程出错，可稍后重试）`);
        }
      } else {
        MessagePlugin.success(`成功导入 ${totalImported} 笔交易`);
      }

      await loadTransactions();
      await loadImportRecords();
    } else if (newSummaries.length > 0) {
      MessagePlugin.info('所有交易均已存在，无新增数据');
    }
  }, [loadTransactions, loadImportRecords]);

  const processFile = async (file: File): Promise<ParseSummary | null> => {
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();

    const supportedExts = ['csv', 'xlsx', 'xls'];
    if (!ext || !supportedExts.includes(ext)) {
      MessagePlugin.warning(`暂不支持 .${ext} 格式，请上传 CSV 或 XLSX 文件`);
      return null;
    }

    // xlsx/xls 文件：先检查文件名判断平台
    if (ext === 'xlsx' || ext === 'xls') {
      const detected = detectByFileName(fileName);
      if (detected.type === 'wechat_xlsx') {
        // 微信 xlsx 解析
        const parseResult = await parseWechatXLSX(file);
        if (parseResult.errors.length > 0) {
          console.error('解析错误:', parseResult.errors);
        }
        if (parseResult.transactions.length === 0) {
          MessagePlugin.warning(`${fileName} 中没有有效交易记录`);
          return null;
        }
        return await saveTransactions(parseResult, fileName);
      }
      if (detected.type === 'taobao_excel') {
        // 淘宝订单 Excel 解析
        const taobaoResult = await parseTaobaoExcel(file);
        if (taobaoResult.errors.length > 0) {
          console.error('淘宝解析错误:', taobaoResult.errors);
        }
        if (taobaoResult.orders.length === 0) {
          MessagePlugin.warning(`${fileName} 中没有有效淘宝订单`);
          return null;
        }
        return await saveTaobaoOrders(taobaoResult, fileName);
      }
      // 未识别的 xlsx — 尝试按内容探测淘宝格式
      const taobaoResult = await parseTaobaoExcel(file);
      if (taobaoResult.orders.length > 0) {
        return await saveTaobaoOrders(taobaoResult, fileName);
      }
      MessagePlugin.warning(`暂不支持此 Excel 文件类型，目前支持微信账单 xlsx 和淘宝订单 xlsx`);
      return null;
    }

    // CSV 文件：读取内容并检测平台
    const content = await readFileContent(file);

    let detected = detectCSVPlatform(content);
    if (detected.type === 'unknown') {
      detected = detectByFileName(fileName);
    }

    if (detected.type === 'unknown') {
      MessagePlugin.error(`无法识别文件 ${fileName} 的格式`);
      return null;
    }

    // 解析 CSV
    let parseResult;
    if (detected.type === 'wechat_csv') {
      parseResult = parseWechatCSV(content);
    } else if (detected.type === 'alipay_csv') {
      parseResult = parseAlipayCSV(content);
    } else {
      MessagePlugin.warning('暂不支持此文件类型');
      return null;
    }

    if (parseResult.errors.length > 0) {
      console.error('解析错误:', parseResult.errors);
    }

    if (parseResult.transactions.length === 0) {
      MessagePlugin.warning(`${fileName} 中没有有效交易记录`);
      return null;
    }

    return await saveTransactions(parseResult, fileName);
  };

  /** 分类 + 去重 + 入库 */
  const saveTransactions = async (
    parseResult: import('@/core/parser/types').ParseResult,
    fileName: string
  ): Promise<ParseSummary> => {
    const batchId = generateBatchId();
    const importTime = new Date().toISOString();
    let newImported = 0;
    let duplicateSkipped = 0;
    let classifiedCount = 0;
    let unclassifiedCount = 0;

    // 批量分类
    setProgressText('正在分类...');
    const classifyResults = await classifierOrchestrator.classifyBatch(
      parseResult.transactions
    );

    const transactionsToSave: Transaction[] = [];

    for (let j = 0; j < parseResult.transactions.length; j++) {
      const parsed = parseResult.transactions[j];
      const classifyResult = classifyResults[j];

      // 检查去重
      const exists = await isTransactionExists(
        parsed.platform,
        parsed.transactionId
      );
      if (exists) {
        duplicateSkipped++;
        continue;
      }

      const txn: Transaction = {
        ...parsed,
        category: classifyResult.category,
        classifySource: classifyResult.source,
        classifyConfidence: classifyResult.confidence,
        classifyReason: classifyResult.reason,
        importBatchId: batchId,
        importTime,
      };

      transactionsToSave.push(txn);

      if (classifyResult.category === '未分类') {
        unclassifiedCount++;
      } else {
        classifiedCount++;
      }
    }

    if (transactionsToSave.length > 0) {
      await db.transactions.bulkAdd(transactionsToSave);
      newImported = transactionsToSave.length;

      // 保存导入记录
      const importRecord: ImportRecord = {
        batchId,
        fileName,
        platform: parseResult.platform,
        recordCount: newImported,
        importTime,
        dateRange: parseResult.dateRange
          ? `${parseResult.dateRange.start.slice(0, 10)} ~ ${parseResult.dateRange.end.slice(0, 10)}`
          : undefined,
      };
      await db.importRecords.add(importRecord);
    }

    return {
      fileName,
      platform: parseResult.platform === 'wechat' ? '微信' : '支付宝',
      totalParsed: parseResult.transactions.length,
      newImported,
      duplicateSkipped,
      classifiedCount,
      unclassifiedCount,
    };
  };

  /** 淘宝订单入库 */
  const saveTaobaoOrders = async (
    taobaoResult: import('@/core/parser/taobao').TaobaoParseResult,
    fileName: string
  ): Promise<ParseSummary> => {
    const batchId = generateBatchId();
    const importTime = new Date().toISOString();
    let newImported = 0;
    let duplicateSkipped = 0;

    setProgressText('正在保存淘宝订单...');

    const ordersToSave: TaobaoOrder[] = [];

    for (const order of taobaoResult.orders) {
      // 去重：按订单号 + 商品名
      const existing = await db.taobaoOrders
        .where('orderId')
        .equals(order.orderId)
        .filter((o) => o.itemName === order.itemName)
        .count();

      if (existing > 0) {
        duplicateSkipped++;
        continue;
      }

      ordersToSave.push({
        ...order,
        importBatchId: batchId,
        importTime,
      });
    }

    if (ordersToSave.length > 0) {
      await db.taobaoOrders.bulkAdd(ordersToSave);
      newImported = ordersToSave.length;

      const importRecord: ImportRecord = {
        batchId,
        fileName,
        platform: 'taobao',
        recordCount: newImported,
        importTime,
        dateRange: taobaoResult.dateRange
          ? `${taobaoResult.dateRange.start.slice(0, 10)} ~ ${taobaoResult.dateRange.end.slice(0, 10)}`
          : undefined,
      };
      await db.importRecords.add(importRecord);
    }

    return {
      fileName,
      platform: '淘宝',
      totalParsed: taobaoResult.orders.length,
      newImported,
      duplicateSkipped,
      classifiedCount: 0,
      unclassifiedCount: 0,
    };
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const totalImported = summaries.reduce((s, r) => s + r.newImported, 0);

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* 上传区域 */}
      <div
        className={`border-2 border-dashed rounded-r-lg p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-brand bg-brand-light scale-[1.01]'
            : 'border-gray-300 bg-white hover:border-brand hover:bg-brand-fade'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />

        <CloudUploadIcon size="48px" className="mx-auto mb-4 text-gray-400" />

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          拖拽上传文件
        </h3>

        <div className="text-sm text-gray-500 space-y-1 mb-4">
          <p><strong>支付账单：</strong>微信账单 XLSX/CSV · 支付宝账单 CSV</p>
          <p><strong>购物清单：</strong>淘宝订单 Excel</p>
        </div>

        <Button theme="primary" size="large">
          选择文件
        </Button>
        <p className="text-xs text-gray-400 mt-2">支持多选</p>
      </div>

      {/* 解析进度 */}
      {isProcessing && (
        <div className="bg-white rounded-r-md p-6 shadow-card">
          <p className="text-sm text-gray-600 mb-2">{progressText}</p>
          <Progress percentage={progress} />
        </div>
      )}

      {/* 解析结果 */}
      {summaries.length > 0 && (
        <div className="bg-white rounded-r-md p-6 shadow-card space-y-4">
          <h3 className="text-base font-semibold text-gray-900">导入结果</h3>

          {summaries.map((s, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-r-sm">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                s.platform === '微信' ? 'bg-green-100 text-green-700'
                  : s.platform === '支付宝' ? 'bg-blue-100 text-blue-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {s.platform}
              </span>
              <span className="text-sm text-gray-700 flex-1">{s.fileName}</span>
              <span className="text-sm text-gray-500">
                解析 {s.totalParsed} 笔 · 新增 {s.newImported} 笔
                {s.duplicateSkipped > 0 && ` · 重复 ${s.duplicateSkipped} 笔`}
              </span>
            </div>
          ))}

          {summaries.some((s) => s.unclassifiedCount > 0) && (
            <Alert
              theme="warning"
              message={`${summaries.reduce((s, r) => s + r.unclassifiedCount, 0)} 笔交易尚未分类，你可以在明细页手动分类`}
            />
          )}

          {totalImported > 0 && (
            <div className="flex gap-3 pt-2">
              <Button theme="primary" onClick={() => navigate('/dashboard')}>
                <ChartPieIcon className="mr-1" />
                查看看板
              </Button>
              <Button variant="outline" onClick={() => navigate('/transactions')}>
                <ViewListIcon className="mr-1" />
                查看明细
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 当前模式 */}
      <div className="text-center text-xs text-gray-400">
        当前模式：🔧 本地规则模式 · 数据仅存储在浏览器中
      </div>

      {/* 导入历史 */}
      <ImportHistory />
    </div>
  );
};

export default UploadPage;
