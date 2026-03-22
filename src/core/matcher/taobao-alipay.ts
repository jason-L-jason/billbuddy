import { Transaction, TaobaoOrder, EcommerceMatch, EcommerceItem } from '@/types';

/**
 * 从支付宝商家订单号中提取淘宝订单号
 *
 * 支付宝格式: T200P{淘宝订单号}
 * 例: T200P275826978034907654 → 275826978034907654
 */
export function extractTaobaoOrderId(merchantOrderId: string): string | null {
  if (!merchantOrderId) return null;
  const match = merchantOrderId.match(/T200P(\d+)/);
  return match ? match[1] : null;
}

/**
 * 精确匹配：通过支付宝商家订单号中的 T200P 前缀
 */
export function exactMatch(
  transaction: Transaction,
  taobaoOrders: TaobaoOrder[]
): { orders: TaobaoOrder[]; orderId: string } | null {
  if (!transaction.merchantOrderId) return null;

  const extractedId = extractTaobaoOrderId(transaction.merchantOrderId);
  if (!extractedId) return null;

  // 淘宝同一订单号可能有多个商品行
  const matched = taobaoOrders.filter((o) => o.orderId === extractedId);
  if (matched.length === 0) return null;

  return { orders: matched, orderId: extractedId };
}

/**
 * 模糊匹配：交易对方含"淘宝" + 金额接近(±5%) + 时间接近(30分钟内)
 */
export function fuzzyMatch(
  transaction: Transaction,
  taobaoOrders: TaobaoOrder[]
): { orders: TaobaoOrder[]; orderId: string; confidence: number } | null {
  // 条件 1: 交易对方或商品说明须含淘宝相关关键词
  const text = `${transaction.counterparty} ${transaction.description}`.toLowerCase();
  if (!text.includes('淘宝') && !text.includes('taobao')) return null;

  // 按订单号分组（同一订单的多个商品合并）
  const orderGroups = groupByOrderId(taobaoOrders);

  let bestMatch: { orders: TaobaoOrder[]; orderId: string; confidence: number } | null = null;

  for (const [orderId, orders] of Object.entries(orderGroups)) {
    // 该订单的总实付金额
    const orderTotal = orders.reduce((sum, o) => sum + o.actualPaid, 0);

    // 条件 2: 金额匹配（允许 ±5% 浮动）
    const amountDiff = Math.abs(transaction.amount - orderTotal);
    const amountRatio = orderTotal > 0 ? amountDiff / orderTotal : 1;
    if (amountRatio > 0.05) continue;

    // 条件 3: 时间接近（30 分钟内）
    const txnTime = new Date(transaction.transactionTime).getTime();
    const orderTime = new Date(orders[0].orderTime).getTime();
    const timeDiffMinutes = Math.abs(txnTime - orderTime) / (1000 * 60);
    if (timeDiffMinutes > 30) continue;

    // 计算综合置信度
    const amountScore = 1 - amountRatio; // 金额越接近越高
    const timeScore = 1 - timeDiffMinutes / 30; // 时间越接近越高
    const confidence = 0.7 + 0.15 * amountScore + 0.15 * timeScore;

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = { orders, orderId, confidence };
    }
  }

  return bestMatch;
}

/** 将淘宝订单列表转为 EcommerceMatch */
export function toEcommerceMatch(
  orders: TaobaoOrder[],
  orderId: string,
  method: 'order_id' | 'amount_time',
  confidence: number
): EcommerceMatch {
  const items: EcommerceItem[] = orders.map((o) => ({
    name: o.itemName,
    quantity: o.quantity,
    unitPrice: o.price,
    actualPaid: o.actualPaid,
    shopName: o.shopName,
  }));

  return {
    platform: 'taobao',
    orderId,
    items,
    matchMethod: method,
    matchConfidence: confidence,
  };
}

/** 按订单号分组 */
function groupByOrderId(orders: TaobaoOrder[]): Record<string, TaobaoOrder[]> {
  const groups: Record<string, TaobaoOrder[]> = {};
  for (const order of orders) {
    if (!groups[order.orderId]) {
      groups[order.orderId] = [];
    }
    groups[order.orderId].push(order);
  }
  return groups;
}
