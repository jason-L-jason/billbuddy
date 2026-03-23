import { Transaction, JdOrder, EcommerceMatch, EcommerceItem } from '@/types';

/**
 * 京东订单与微信/支付宝交易匹配
 *
 * 京东主要通过微信支付、支付宝或京东白条付款。
 * 匹配策略：
 *   1. 精确匹配：微信/支付宝的 merchantOrderId 中可能包含京东订单号
 *   2. 模糊匹配：交易对方含「京东」+ 金额接近(±5%) + 时间接近(60分钟内)
 *
 * 注意：京东订单号通常较长（如 275826978034907654），
 * 微信/支付宝商家订单号可能直接包含或加前缀包含此号。
 */

/**
 * 精确匹配：检查商家订单号是否包含京东订单号
 */
export function exactMatchJd(
  transaction: Transaction,
  jdOrders: JdOrder[]
): { orders: JdOrder[]; orderId: string } | null {
  if (!transaction.merchantOrderId) return null;

  const merchantId = transaction.merchantOrderId;

  // 遍历所有京东订单号，看商家订单号是否包含
  for (const order of jdOrders) {
    if (merchantId.includes(order.orderId)) {
      const matched = jdOrders.filter((o) => o.orderId === order.orderId);
      return { orders: matched, orderId: order.orderId };
    }
  }

  return null;
}

/**
 * 模糊匹配：交易对方/描述含「京东」+ 金额接近 + 时间接近
 */
export function fuzzyMatchJd(
  transaction: Transaction,
  jdOrders: JdOrder[]
): { orders: JdOrder[]; orderId: string; confidence: number } | null {
  // 条件 1: 交易对方或商品说明含京东相关关键词
  const text = `${transaction.counterparty} ${transaction.description}`.toLowerCase();
  if (!text.includes('京东') && !text.includes('jd') && !text.includes('jingdong')) return null;

  // 按订单号分组
  const orderGroups = groupByOrderId(jdOrders);

  let bestMatch: { orders: JdOrder[]; orderId: string; confidence: number } | null = null;

  for (const [orderId, orders] of Object.entries(orderGroups)) {
    // 该订单的总实付金额
    const orderTotal = orders.reduce((sum, o) => sum + o.actualPaid, 0);

    // 条件 2: 金额匹配（允许 ±5% 浮动）
    const amountDiff = Math.abs(transaction.amount - orderTotal);
    const amountRatio = orderTotal > 0 ? amountDiff / orderTotal : 1;
    if (amountRatio > 0.05) continue;

    // 条件 3: 时间接近（60 分钟内，京东付款到微信扣款可能有延迟）
    const txnTime = new Date(transaction.transactionTime).getTime();
    const orderTime = new Date(orders[0].orderTime).getTime();
    const timeDiffMinutes = Math.abs(txnTime - orderTime) / (1000 * 60);
    if (timeDiffMinutes > 60) continue;

    // 计算综合置信度
    const amountScore = 1 - amountRatio;
    const timeScore = 1 - timeDiffMinutes / 60;
    const confidence = 0.7 + 0.15 * amountScore + 0.15 * timeScore;

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = { orders, orderId, confidence };
    }
  }

  return bestMatch;
}

/** 将京东订单列表转为 EcommerceMatch */
export function toJdEcommerceMatch(
  orders: JdOrder[],
  orderId: string,
  method: 'order_id' | 'amount_time',
  confidence: number
): EcommerceMatch {
  const items: EcommerceItem[] = orders.map((o) => ({
    name: o.itemName,
    sku: o.sku,
    quantity: o.quantity,
    unitPrice: o.price,
    actualPaid: o.actualPaid,
    shopName: o.shopName,
  }));

  return {
    platform: 'jd',
    orderId,
    items,
    matchMethod: method,
    matchConfidence: confidence,
  };
}

/** 按订单号分组 */
function groupByOrderId(orders: JdOrder[]): Record<string, JdOrder[]> {
  const groups: Record<string, JdOrder[]> = {};
  for (const order of orders) {
    if (!groups[order.orderId]) {
      groups[order.orderId] = [];
    }
    groups[order.orderId].push(order);
  }
  return groups;
}
