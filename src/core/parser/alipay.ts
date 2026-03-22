import Papa from 'papaparse';
import { ParseResult, ParsedTransaction } from './types';

/**
 * 支付宝账单 CSV 解析器
 *
 * 支付宝账单特点：
 * - GBK 编码（需要在上传时用 TextDecoder 转换）
 * - 前面有约 4-5 行说明文字
 * - 有"交易分类"字段，可直接利用
 * - 商家订单号包含淘宝订单号信息（T200P{淘宝订单号}）
 * - 字段：交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
 */
export function parseAlipayCSV(csvContent: string): ParseResult {
  const errors: string[] = [];
  let skippedCount = 0;

  // 找到表头行
  const lines = csvContent.split('\n');
  let headerLineIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (lines[i].includes('交易时间') && (lines[i].includes('商品说明') || lines[i].includes('交易对方'))) {
      headerLineIndex = i;
      break;
    }
  }

  if (headerLineIndex === -1) {
    return {
      platform: 'alipay',
      transactions: [],
      skippedCount: 0,
      errors: ['无法识别支付宝账单格式：找不到表头行'],
    };
  }

  // 从表头行开始解析
  const csvData = lines.slice(headerLineIndex).join('\n');

  const parsed = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    parsed.errors.forEach((e) => {
      errors.push(`第 ${e.row} 行解析错误: ${e.message}`);
    });
  }

  const transactions: ParsedTransaction[] = [];

  for (const row of parsed.data as Record<string, string>[]) {
    const timeStr = row['交易时间']?.trim();
    const alipayCategory = row['交易分类']?.trim();
    const counterparty = row['交易对方']?.trim();
    const description = row['商品说明']?.trim();
    const directionStr = row['收/支']?.trim();
    const amountStr = row['金额']?.trim() || row['金额（元）']?.trim();
    const paymentMethod = row['收/付款方式']?.trim();
    const status = row['交易状态']?.trim();
    const transactionId = row['交易订单号']?.trim();
    const merchantOrderId = row['商家订单号']?.trim();
    const note = row['备注']?.trim();

    // 跳过无效行
    if (!timeStr || !amountStr) {
      skippedCount++;
      continue;
    }

    // 过滤非正常交易
    if (status && !['交易成功', '还款成功', '充值成功', '转账成功', '缴费成功'].includes(status)) {
      skippedCount++;
      continue;
    }

    // 解析金额
    const amount = parseFloat(amountStr.replace(/[¥￥,\s]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      skippedCount++;
      continue;
    }

    // 解析交易方向
    let direction: 'income' | 'expense' | 'other' = 'other';
    if (directionStr === '支出') direction = 'expense';
    else if (directionStr === '收入') direction = 'income';
    else direction = 'other';

    // 解析时间
    const transactionTime = parseAlipayTime(timeStr);

    transactions.push({
      platform: 'alipay',
      transactionTime,
      counterparty: counterparty || '',
      description: description || '',
      direction,
      amount,
      paymentMethod,
      status: status || '',
      transactionId: transactionId || `alipay_${Date.now()}_${Math.random()}`,
      merchantOrderId,
      note,
      alipayCategory,
    });
  }

  // 计算日期范围
  let dateRange: ParseResult['dateRange'];
  if (transactions.length > 0) {
    const times = transactions.map((t) => new Date(t.transactionTime).getTime());
    dateRange = {
      start: new Date(Math.min(...times)).toISOString(),
      end: new Date(Math.max(...times)).toISOString(),
    };
  }

  return {
    platform: 'alipay',
    transactions,
    skippedCount,
    errors,
    dateRange,
  };
}

/** 支付宝时间格式 → ISO */
function parseAlipayTime(timeStr: string): string {
  const d = new Date(timeStr.replace(/\//g, '-'));
  if (isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}
