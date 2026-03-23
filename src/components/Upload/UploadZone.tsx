import React, { useState, useCallback } from 'react';
import { Button, Alert, MessagePlugin, Progress } from 'tdesign-react';
import { CloudUploadIcon } from 'tdesign-icons-react';
import { parseWechatCSV } from '@/core/parser/wechat';
import { parseWechatXLSX } from '@/core/parser/wechat-xlsx';
import { parseAlipayCSV } from '@/core/parser/alipay';
import { parseTaobaoExcel } from '@/core/parser/taobao';
import { parseJdExcel } from '@/core/parser/jd';
import { detectCSVPlatform, readFileContent, detectByFileName } from '@/core/parser/detector';
import { classifierOrchestrator } from '@/core/classifier/orchestrator';
import { orderMatcher } from '@/core/matcher';
import { db, generateBatchId, isTransactionExists } from '@/db';
import { useTransactionsStore } from '@/store/transactions';
import { Transaction, ImportRecord, TaobaoOrder, JdOrder } from '@/types';

export interface ParseSummary {
  fileName: string;
  platform: string;
  totalParsed: number;
  newImported: number;
  duplicateSkipped: number;
  classifiedCount: number;
  unclassifiedCount: number;
}

interface UploadZoneProps {
  /** 紧凑模式：有数据时折叠为小条 */
  compact?: boolean;
  /** 导入完成后回调 */
  onImportComplete?: (summaries: ParseSummary[]) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ compact = false, onImportComplete }) => {
  const { loadTransactions, loadImportRecords, loadAvailableMonths } = useTransactionsStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [expanded, setExpanded] = useState(!compact);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

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

    setIsProcessing(false);
    setProgressText('');

    const totalImported = newSummaries.reduce((s, r) => s + r.newImported, 0);
    if (totalImported > 0) {
      const hasTaobao = newSummaries.some((s) => s.platform === '淘宝');
      const hasJd = newSummaries.some((s) => s.platform === '京东');
      const hasEcommerce = hasTaobao || hasJd;
      const hasPayment = newSummaries.some((s) => s.platform !== '淘宝' && s.platform !== '京东');

      if (hasEcommerce) {
        const ecomNames = [hasTaobao && '淘宝', hasJd && '京东'].filter(Boolean).join('和');
        setProgressText(`正在匹配${ecomNames}订单与支付交易...`);
        try {
          const matchStats = await orderMatcher.matchAll();
          if (matchStats.updatedCount > 0) {
            MessagePlugin.success(
              `成功导入 ${totalImported} 条数据，自动匹配 ${matchStats.exactMatches} 笔精确 + ${matchStats.fuzzyMatches} 笔模糊`
            );
          } else if (!hasPayment) {
            MessagePlugin.success(`成功导入 ${totalImported} 条${ecomNames}订单`);
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

      await loadAvailableMonths();
      await loadTransactions();
      await loadImportRecords();
    } else if (newSummaries.length > 0) {
      MessagePlugin.info('所有交易均已存在，无新增数据');
    }

    if (compact) {
      setExpanded(false);
    }

    onImportComplete?.(newSummaries);
  }, [loadTransactions, loadImportRecords, loadAvailableMonths, compact, onImportComplete]);

  const processFile = async (file: File): Promise<ParseSummary | null> => {
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();

    const supportedExts = ['csv', 'xlsx', 'xls'];
    if (!ext || !supportedExts.includes(ext)) {
      MessagePlugin.warning(`暂不支持 .${ext} 格式，请上传 CSV 或 XLSX 文件`);
      return null;
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const detected = detectByFileName(fileName);
      if (detected.type === 'wechat_xlsx') {
        const parseResult = await parseWechatXLSX(file);
        if (parseResult.errors.length > 0) console.error('解析错误:', parseResult.errors);
        if (parseResult.transactions.length === 0) {
          MessagePlugin.warning(`${fileName} 中没有有效交易记录`);
          return null;
        }
        return await saveTransactions(parseResult, fileName);
      }
      if (detected.type === 'taobao_excel') {
        const taobaoResult = await parseTaobaoExcel(file);
        if (taobaoResult.errors.length > 0) console.error('淘宝解析错误:', taobaoResult.errors);
        if (taobaoResult.orders.length === 0) {
          MessagePlugin.warning(`${fileName} 中没有有效淘宝订单`);
          return null;
        }
        return await saveTaobaoOrders(taobaoResult, fileName);
      }
      if (detected.type === 'jd_excel') {
        const jdResult = await parseJdExcel(file);
        if (jdResult.errors.length > 0) console.error('京东解析错误:', jdResult.errors);
        if (jdResult.orders.length === 0) {
          MessagePlugin.warning(`${fileName} 中没有有效京东订单`);
          return null;
        }
        return await saveJdOrders(jdResult, fileName);
      }
      // 未识别的 Excel：依次尝试淘宝 → 京东
      const taobaoResult = await parseTaobaoExcel(file);
      if (taobaoResult.orders.length > 0) {
        return await saveTaobaoOrders(taobaoResult, fileName);
      }
      const jdResult = await parseJdExcel(file);
      if (jdResult.orders.length > 0) {
        return await saveJdOrders(jdResult, fileName);
      }
      MessagePlugin.warning(`暂不支持此 Excel 文件类型，目前支持微信账单、淘宝订单、京东订单 xlsx`);
      return null;
    }

    const content = await readFileContent(file);
    let detected = detectCSVPlatform(content);
    if (detected.type === 'unknown') detected = detectByFileName(fileName);

    if (detected.type === 'unknown') {
      MessagePlugin.error(`无法识别文件 ${fileName} 的格式`);
      return null;
    }

    let parseResult;
    if (detected.type === 'wechat_csv') {
      parseResult = parseWechatCSV(content);
    } else if (detected.type === 'alipay_csv') {
      parseResult = parseAlipayCSV(content);
    } else {
      MessagePlugin.warning('暂不支持此文件类型');
      return null;
    }

    if (parseResult.errors.length > 0) console.error('解析错误:', parseResult.errors);
    if (parseResult.transactions.length === 0) {
      MessagePlugin.warning(`${fileName} 中没有有效交易记录`);
      return null;
    }

    return await saveTransactions(parseResult, fileName);
  };

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

    setProgressText('正在分类...');
    const classifyResults = await classifierOrchestrator.classifyBatch(
      parseResult.transactions
    );

    const transactionsToSave: Transaction[] = [];

    for (let j = 0; j < parseResult.transactions.length; j++) {
      const parsed = parseResult.transactions[j];
      const classifyResult = classifyResults[j];

      const exists = await isTransactionExists(parsed.platform, parsed.transactionId);
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

  const saveJdOrders = async (
    jdResult: import('@/core/parser/jd').JdParseResult,
    fileName: string
  ): Promise<ParseSummary> => {
    const batchId = generateBatchId();
    const importTime = new Date().toISOString();
    let newImported = 0;
    let duplicateSkipped = 0;

    setProgressText('正在保存京东订单...');

    const ordersToSave: JdOrder[] = [];

    for (const order of jdResult.orders) {
      const existing = await db.jdOrders
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
      await db.jdOrders.bulkAdd(ordersToSave);
      newImported = ordersToSave.length;

      const importRecord: ImportRecord = {
        batchId,
        fileName,
        platform: 'jd',
        recordCount: newImported,
        importTime,
        dateRange: jdResult.dateRange
          ? `${jdResult.dateRange.start.slice(0, 10)} ~ ${jdResult.dateRange.end.slice(0, 10)}`
          : undefined,
      };
      await db.importRecords.add(importRecord);
    }

    return {
      fileName,
      platform: '京东',
      totalParsed: jdResult.orders.length,
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

  // 紧凑模式：折叠条
  if (compact && !expanded && !isProcessing) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-brand hover:text-brand hover:bg-brand-fade transition-all cursor-pointer group"
      >
        <CloudUploadIcon size="18px" className="text-gray-400 group-hover:text-brand transition-colors" />
        <span>导入更多账单</span>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer ${
          compact ? 'p-6 md:p-8' : 'p-10 md:p-12'
        } text-center ${
          isDragging
            ? 'border-brand bg-brand-light scale-[1.01]'
            : 'border-gray-300 bg-white hover:border-brand hover:bg-brand-fade'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        {compact && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors text-xs cursor-pointer"
            title="收起"
          >
            ✕
          </button>
        )}

        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />

        <CloudUploadIcon size={compact ? '36px' : '48px'} className="mx-auto mb-3 text-gray-400" />

        <h3 className={`font-semibold text-gray-900 mb-1.5 ${compact ? 'text-base' : 'text-lg'}`}>
          {isDragging ? '松开即可上传' : '拖拽上传文件'}
        </h3>

        <div className="text-sm text-gray-500 space-y-0.5 mb-3">
          <p><strong>支付账单：</strong>微信账单 XLSX/CSV · 支付宝账单 CSV</p>
          <p><strong>购物清单：</strong>淘宝/京东订单 Excel（可自动匹配支付交易）</p>
        </div>

        <Button theme="primary" size={compact ? 'medium' : 'large'}>
          选择文件
        </Button>
        <p className="text-xs text-gray-400 mt-2">支持多选 · 重复文件自动去重</p>
      </div>

      {/* 解析进度 */}
      {isProcessing && (
        <div className="bg-white rounded-xl p-5 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-700 font-medium">{progressText || '处理中...'}</p>
          </div>
          <Progress percentage={progress} />
        </div>
      )}
    </div>
  );
};

export default UploadZone;
