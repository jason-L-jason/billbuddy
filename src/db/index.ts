import Dexie, { Table } from 'dexie';
import { Transaction, TaobaoOrder, ImportRecord, CustomRule } from '@/types';

export class BillBuddyDB extends Dexie {
  transactions!: Table<Transaction, number>;
  taobaoOrders!: Table<TaobaoOrder, number>;
  importRecords!: Table<ImportRecord, number>;
  customRules!: Table<CustomRule, number>;

  constructor() {
    super('BillBuddyDB');

    this.version(1).stores({
      transactions: '++id, platform, transactionTime, transactionId, category, direction, importBatchId, [platform+transactionId]',
      taobaoOrders: '++id, orderId, orderTime, importBatchId',
      importRecords: '++id, batchId, platform, importTime',
      customRules: '++id, field, keyword, category',
    });
  }
}

export const db = new BillBuddyDB();

// ====== 工具函数 ======

/** 生成导入批次 ID */
export function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 检查交易是否已存在（基于平台 + 交易单号去重） */
export async function isTransactionExists(
  platform: string,
  transactionId: string
): Promise<boolean> {
  const count = await db.transactions
    .where('[platform+transactionId]')
    .equals([platform, transactionId])
    .count();
  return count > 0;
}

/** 获取指定月份的交易 */
export async function getTransactionsByMonth(
  year: number,
  month: number
): Promise<Transaction[]> {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  return db.transactions
    .where('transactionTime')
    .between(startDate, endDate, true, true)
    .toArray();
}

/** 获取所有导入记录 */
export async function getImportRecords(): Promise<ImportRecord[]> {
  return db.importRecords.orderBy('importTime').reverse().toArray();
}

/** 清除所有数据 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.transactions.clear(),
    db.taobaoOrders.clear(),
    db.importRecords.clear(),
  ]);
}
