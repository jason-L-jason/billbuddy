import { Transaction, TaobaoOrder, EcommerceMatch } from '@/types';

/** 单次匹配结果 */
export interface MatchResult {
  transaction: Transaction;
  taobaoOrders: TaobaoOrder[];
  match: EcommerceMatch;
}

/** 匹配统计 */
export interface MatchStats {
  totalTransactions: number;
  exactMatches: number;
  fuzzyMatches: number;
  unmatched: number;
  updatedCount: number;
}
