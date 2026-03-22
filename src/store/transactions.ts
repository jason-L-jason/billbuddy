import { create } from 'zustand';
import { Transaction, ImportRecord, CategoryType, ClassifySource } from '@/types';
import { db, getImportRecords } from '@/db';
import { classifierOrchestrator } from '@/core/classifier/orchestrator';

interface TransactionsState {
  transactions: Transaction[];
  importRecords: ImportRecord[];
  selectedMonth: string; // "YYYY-MM" 格式
  isLoading: boolean;

  setSelectedMonth: (month: string) => void;
  loadTransactions: () => Promise<void>;
  loadImportRecords: () => Promise<void>;
  addTransactions: (txns: Transaction[]) => Promise<void>;
  updateTransactionCategory: (
    id: number,
    category: string,
    source: string
  ) => Promise<void>;
  reclassifyAll: () => Promise<{ updated: number; total: number }>;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  importRecords: [],
  selectedMonth: getCurrentMonth(),
  isLoading: false,

  setSelectedMonth: (month: string) => {
    set({ selectedMonth: month });
    get().loadTransactions();
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
    await get().loadTransactions();
    await get().loadImportRecords();
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
