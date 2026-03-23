import Dexie, { Table } from 'dexie';
import { Transaction, TaobaoOrder, JdOrder, ImportRecord, CustomRule } from '@/types';

export class BillBuddyDB extends Dexie {
  transactions!: Table<Transaction, number>;
  taobaoOrders!: Table<TaobaoOrder, number>;
  jdOrders!: Table<JdOrder, number>;
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

    this.version(2).stores({
      transactions: '++id, platform, transactionTime, transactionId, category, direction, importBatchId, [platform+transactionId]',
      taobaoOrders: '++id, orderId, orderTime, importBatchId',
      jdOrders: '++id, orderId, orderTime, importBatchId',
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

/** 清除所有数据（保留自定义规则） */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.transactions.clear(),
    db.taobaoOrders.clear(),
    db.jdOrders.clear(),
    db.importRecords.clear(),
  ]);
}

/** 清除所有数据（包括自定义规则） */
export async function clearAllDataIncludingRules(): Promise<void> {
  await Promise.all([
    db.transactions.clear(),
    db.taobaoOrders.clear(),
    db.jdOrders.clear(),
    db.importRecords.clear(),
    db.customRules.clear(),
  ]);
}

/** 按 "YYYY-MM" 格式获取某月交易 */
export async function getTransactionsByMonthStr(month: string): Promise<Transaction[]> {
  const [y, m] = month.split('-').map(Number);
  const startDate = new Date(y, m - 1, 1).toISOString();
  const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
  return db.transactions
    .where('transactionTime')
    .between(startDate, endDate, true, true)
    .toArray();
}

/** 获取所有有数据的月份列表（降序） */
export async function getAvailableMonths(): Promise<string[]> {
  const allTxns = await db.transactions.orderBy('transactionTime').keys();
  const monthSet = new Set<string>();
  for (const time of allTxns) {
    if (typeof time === 'string') {
      const d = new Date(time);
      if (!isNaN(d.getTime())) {
        monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }
  }
  return Array.from(monthSet).sort().reverse();
}

/** 批量删除交易记录 */
export async function deleteTransactions(ids: number[]): Promise<void> {
  await db.transactions.bulkDelete(ids);
}
