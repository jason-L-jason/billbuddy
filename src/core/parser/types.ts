import { Platform, TransactionDirection, CategoryType } from '@/types';

/** 解析后的原始交易记录（未分类） */
export interface ParsedTransaction {
  platform: Platform;
  transactionTime: string;
  transactionType?: string;
  counterparty: string;
  description: string;
  direction: TransactionDirection;
  amount: number;
  paymentMethod?: string;
  status: string;
  transactionId: string;
  merchantOrderId?: string;
  note?: string;
  alipayCategory?: string;
}

/** 解析结果 */
export interface ParseResult {
  platform: Platform;
  transactions: ParsedTransaction[];
  skippedCount: number;
  errors: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}
