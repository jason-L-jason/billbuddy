import { db } from '@/db';
import { Transaction, TaobaoOrder } from '@/types';
import { MatchStats } from './types';
import { exactMatch, fuzzyMatch, toEcommerceMatch } from './taobao-alipay';

/**
 * OrderMatcher — 电商订单匹配引擎
 *
 * 负责将淘宝订单与支付宝交易记录进行匹配。
 * 匹配策略：
 *   1. 精确匹配：支付宝 merchantOrderId 中的 T200P{淘宝订单号}
 *   2. 模糊匹配：交易对方含"淘宝" + 金额接近 + 时间接近
 *   3. 未匹配：标记为未匹配
 */
export class OrderMatcher {
  /**
   * 执行全量匹配：扫描所有支付宝交易，尝试匹配淘宝订单
   * @returns 匹配统计
   */
  async matchAll(): Promise<MatchStats> {
    // 获取所有淘宝订单
    const taobaoOrders = await db.taobaoOrders.toArray();
    if (taobaoOrders.length === 0) {
      return { totalTransactions: 0, exactMatches: 0, fuzzyMatches: 0, unmatched: 0, updatedCount: 0 };
    }

    // 获取所有支付宝交易（淘宝通过支付宝支付）
    const alipayTransactions = await db.transactions
      .where('platform')
      .equals('alipay')
      .toArray();

    let exactMatches = 0;
    let fuzzyMatches = 0;
    let unmatched = 0;
    let updatedCount = 0;

    // 记录已被精确匹配的淘宝订单号，避免模糊匹配重复
    const matchedOrderIds = new Set<string>();

    for (const txn of alipayTransactions) {
      // 如果已有匹配信息且是精确匹配，跳过
      if (txn.ecommerceMatch?.matchMethod === 'order_id') {
        exactMatches++;
        matchedOrderIds.add(txn.ecommerceMatch.orderId);
        continue;
      }

      // 尝试精确匹配
      const exact = exactMatch(txn, taobaoOrders);
      if (exact) {
        const match = toEcommerceMatch(exact.orders, exact.orderId, 'order_id', 1.0);
        await this.updateTransaction(txn, match);
        exactMatches++;
        updatedCount++;
        matchedOrderIds.add(exact.orderId);
        continue;
      }

      // 尝试模糊匹配（排除已被精确匹配的订单）
      const availableOrders = taobaoOrders.filter((o) => !matchedOrderIds.has(o.orderId));
      const fuzzy = fuzzyMatch(txn, availableOrders);
      if (fuzzy) {
        const match = toEcommerceMatch(fuzzy.orders, fuzzy.orderId, 'amount_time', fuzzy.confidence);
        await this.updateTransaction(txn, match);
        fuzzyMatches++;
        updatedCount++;
        matchedOrderIds.add(fuzzy.orderId);
        continue;
      }

      // 检查是否是淘宝相关的交易但未能匹配
      const text = `${txn.counterparty} ${txn.description}`.toLowerCase();
      if (text.includes('淘宝') || text.includes('taobao')) {
        unmatched++;
      }
    }

    return {
      totalTransactions: alipayTransactions.length,
      exactMatches,
      fuzzyMatches,
      unmatched,
      updatedCount,
    };
  }

  /** 更新交易记录的匹配信息 */
  private async updateTransaction(
    txn: Transaction,
    match: import('@/types').EcommerceMatch
  ): Promise<void> {
    if (!txn.id) return;
    await db.transactions.update(txn.id, { ecommerceMatch: match });
  }
}

export const orderMatcher = new OrderMatcher();
