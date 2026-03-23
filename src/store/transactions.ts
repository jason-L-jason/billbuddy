import { create } from 'zustand';
import { Transaction, ImportRecord, CategoryType, ClassifySource } from '@/types';
import { db, getImportRecords, getAvailableMonths, deleteTransactions } from '@/db';
import { classifierOrchestrator } from '@/core/classifier/orchestrator';
import { getCurrentMonth } from '@/utils/month';

interface TransactionsState {
  transactions: Transaction[];
  importRecords: ImportRecord[];
  selectedMonth: string; // "YYYY-MM" 格式
  availableMonths: string[]; // 有数据的月份列表（降序）
  isLoading: boolean;
  monthInitialized: boolean; // 是否已根据数据初始化月份

  setSelectedMonth: (month: string) => void;
  loadTransactions: () => Promise<void>;
  loadImportRecords: () => Promise<void>;
  loadAvailableMonths: () => Promise<void>;
  initMonth: () => Promise<void>;
  addTransactions: (txns: Transaction[]) => Promise<void>;
  deleteTransactionsByIds: (ids: number[]) => Promise<void>;
  updateTransactionCategory: (
    id: number,
    category: string,
    source: string
  ) => Promise<void>;
  reclassifyAll: () => Promise<{ updated: number; total: number }>;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  importRecords: [],
  selectedMonth: getCurrentMonth(),
  availableMonths: [],
  isLoading: false,
  monthInitialized: false,

  setSelectedMonth: (month: string) => {
    set({ selectedMonth: month });
    get().loadTransactions();
  },

  // 初始化月份：自动选最新有数据的月份
  initMonth: async () => {
    if (get().monthInitialized) return;
    const months = await getAvailableMonths();
    set({ availableMonths: months });
    if (months.length > 0) {
      const current = getCurrentMonth();
      // 如果当前月份有数据就用当前月份，否则用最新有数据的月份
      const target = months.includes(current) ? current : months[0];
      set({ selectedMonth: target, monthInitialized: true });
    } else {
      set({ monthInitialized: true });
    }
    await get().loadTransactions();
  },

  loadAvailableMonths: async () => {
    const months = await getAvailableMonths();
    set({ availableMonths: months });
  },

  loadTransactions: async () => {
    set({ isLoading: true });
    const [yearStr, monthStr] = get().selectedMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const txns = await db.transactions
      .where('transactionTime')
      .between(startDate, endDate, true, true)
      .toArray();

    // 按时间倒序
    txns.sort((a, b) =>
      new Date(b.transactionTime).getTime() - new Date(a.transactionTime).getTime()
    );

    set({ transactions: txns, isLoading: false });
  },

  loadImportRecords: async () => {
    const records = await getImportRecords();
    set({ importRecords: records });
  },

  addTransactions: async (txns: Transaction[]) => {
    await db.transactions.bulkAdd(txns);
    await get().loadAvailableMonths();
    await get().loadTransactions();
    await get().loadImportRecords();
  },

  deleteTransactionsByIds: async (ids: number[]) => {
    await deleteTransactions(ids);
    await get().loadAvailableMonths();
    await get().loadTransactions();
  },

  updateTransactionCategory: async (id, category, source) => {
    await db.transactions.update(id, {
      category: category as CategoryType,
      classifySource: source as ClassifySource,
      classifyConfidence: source === 'manual' ? 1.0 : undefined,
    });
    await get().loadTransactions();
  },

  reclassifyAll: async () => {
    // 获取所有非手动分类的交易
    const allTxns = await db.transactions
      .filter((t) => t.classifySource !== 'manual')
      .toArray();

    let updated = 0;

    for (const txn of allTxns) {
      const result = await classifierOrchestrator.classify({
        counterparty: txn.counterparty,
        description: txn.description,
        alipayCategory: txn.alipayCategory,
        platform: txn.platform,
        transactionId: txn.transactionId,
        transactionTime: txn.transactionTime,
        amount: txn.amount,
        direction: txn.direction,
        status: txn.status,
      });

      // 只更新分类发生变化的记录
      if (result.category !== txn.category) {
        await db.transactions.update(txn.id!, {
          category: result.category,
          classifySource: result.source,
          classifyConfidence: result.confidence,
          classifyReason: result.reason,
        });
        updated++;
      }
    }

    await get().loadTransactions();
    return { updated, total: allTxns.length };
  },
}));
