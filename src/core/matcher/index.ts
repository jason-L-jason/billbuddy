import { db } from '@/db';
import { Transaction, TaobaoOrder } from '@/types';
import { MatchStats } from './types';
import { exactMatch, fuzzyMatch, toEcommerceMatch } from './taobao-alipay';
import { exactMatchJd, fuzzyMatchJd, toJdEcommerceMatch } from './jd-wechat';

/**
 * OrderMatcher — 电商订单匹配引擎
 *
 * 负责将电商订单（淘宝、京东）与支付交易记录进行匹配。
 *
 * 淘宝 → 匹配支付宝交易
 * 京东 → 匹配微信 + 支付宝交易（京东可用微信/支付宝/白条支付）
 */
export class OrderMatcher {
  /**
   * 执行全量匹配：淘宝→支付宝 + 京东→微信/支付宝
   * @returns 匹配统计
   */
  async matchAll(): Promise<MatchStats> {
    const taobaoStats = await this.matchTaobao();
    const jdStats = await this.matchJd();

    return {
      totalTransactions: taobaoStats.totalTransactions + jdStats.totalTransactions,
      exactMatches: taobaoStats.exactMatches + jdStats.exactMatches,
      fuzzyMatches: taobaoStats.fuzzyMatches + jdStats.fuzzyMatches,
      unmatched: taobaoStats.unmatched + jdStats.unmatched,
      updatedCount: taobaoStats.updatedCount + jdStats.updatedCount,
    };
  }

  /** 淘宝订单 → 支付宝交易匹配 */
  private async matchTaobao(): Promise<MatchStats> {
    const taobaoOrders = await db.taobaoOrders.toArray();
    if (taobaoOrders.length === 0) {
      return { totalTransactions: 0, exactMatches: 0, fuzzyMatches: 0, unmatched: 0, updatedCount: 0 };
    }

    const alipayTransactions = await db.transactions
      .where('platform')
      .equals('alipay')
      .toArray();

    let exactMatches = 0;
    let fuzzyMatches = 0;
    let unmatched = 0;
    let updatedCount = 0;

    const matchedOrderIds = new Set<string>();

    for (const txn of alipayTransactions) {
      if (txn.ecommerceMatch?.matchMethod === 'order_id' && txn.ecommerceMatch.platform === 'taobao') {
        exactMatches++;
        matchedOrderIds.add(txn.ecommerceMatch.orderId);
        continue;
      }

      const exact = exactMatch(txn, taobaoOrders);
      if (exact) {
        const match = toEcommerceMatch(exact.orders, exact.orderId, 'order_id', 1.0);
        await this.updateTransaction(txn, match);
        exactMatches++;
        updatedCount++;
        matchedOrderIds.add(exact.orderId);
        continue;
      }

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

      const text = `${txn.counterparty} ${txn.description}`.toLowerCase();
      if (text.includes('淘宝') || text.includes('taobao')) {
        unmatched++;
      }
    }

    return {
      totalTransactions: alipayTransactions.length,
      exactMatches, fuzzyMatches, unmatched, updatedCount,
    };
  }

  /** 京东订单 → 微信/支付宝交易匹配 */
  private async matchJd(): Promise<MatchStats> {
    const jdOrders = await db.jdOrders.toArray();
    if (jdOrders.length === 0) {
      return { totalTransactions: 0, exactMatches: 0, fuzzyMatches: 0, unmatched: 0, updatedCount: 0 };
    }

    // 京东可能通过微信或支付宝支付，所以两个平台都要扫
    const allTransactions = await db.transactions.toArray();

    let exactMatches = 0;
    let fuzzyMatches = 0;
    let unmatched = 0;
    let updatedCount = 0;

    const matchedOrderIds = new Set<string>();

    for (const txn of allTransactions) {
      // 跳过已有京东精确匹配的
      if (txn.ecommerceMatch?.matchMethod === 'order_id' && txn.ecommerceMatch.platform === 'jd') {
        exactMatches++;
        matchedOrderIds.add(txn.ecommerceMatch.orderId);
        continue;
      }

      // 尝试精确匹配
      const exact = exactMatchJd(txn, jdOrders);
      if (exact) {
        const match = toJdEcommerceMatch(exact.orders, exact.orderId, 'order_id', 1.0);
        await this.updateTransaction(txn, match);
        exactMatches++;
        updatedCount++;
        matchedOrderIds.add(exact.orderId);
        continue;
      }

      // 尝试模糊匹配
      const availableOrders = jdOrders.filter((o) => !matchedOrderIds.has(o.orderId));
      const fuzzy = fuzzyMatchJd(txn, availableOrders);
      if (fuzzy) {
        const match = toJdEcommerceMatch(fuzzy.orders, fuzzy.orderId, 'amount_time', fuzzy.confidence);
        await this.updateTransaction(txn, match);
        fuzzyMatches++;
        updatedCount++;
        matchedOrderIds.add(fuzzy.orderId);
        continue;
      }

      // 检查是否是京东相关但未匹配
      const text = `${txn.counterparty} ${txn.description}`.toLowerCase();
      if (text.includes('京东') || text.includes('jd')) {
        unmatched++;
      }
    }

    return {
      totalTransactions: allTransactions.length,
      exactMatches, fuzzyMatches, unmatched, updatedCount,
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
