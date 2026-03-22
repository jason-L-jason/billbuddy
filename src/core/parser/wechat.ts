import Papa from 'papaparse';
import { ParseResult, ParsedTransaction } from './types';

/**
 * 微信账单 CSV 解析器
 *
 * 微信账单特点：
 * - UTF-8 编码
 * - 前面有约 16 行说明文字，需要跳过
 * - 金额带 ¥ 符号
 * - 字段：交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
 */
export function parseWechatCSV(csvContent: string): ParseResult {
  const errors: string[] = [];
  let skippedCount = 0;

  // 找到表头行（包含"交易时间"的那一行）
  const lines = csvContent.split('\n');
  let headerLineIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (lines[i].includes('交易时间') && lines[i].includes('交易对方')) {
      headerLineIndex = i;
      break;
    }
  }

  if (headerLineIndex === -1) {
    return {
      platform: 'wechat',
      transactions: [],
      skippedCount: 0,
      errors: ['无法识别微信账单格式：找不到表头行'],
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
    const type = row['交易类型']?.trim();
    const counterparty = row['交易对方']?.trim();
    const description = row['商品']?.trim();
    const directionStr = row['收/支']?.trim();
    const amountStr = row['金额(元)']?.trim();
    const paymentMethod = row['支付方式']?.trim();
    const status = row['当前状态']?.trim();
    const transactionId = row['交易单号']?.trim();
    const merchantOrderId = row['商户单号']?.trim();
    const note = row['备注']?.trim();

    // 跳过无效行
    if (!timeStr || !amountStr) {
      skippedCount++;
      continue;
    }

    // 过滤非正常交易
    if (status && !['支付成功', '已收钱', '已转账', '已存入零钱', '充值完成', '提现已到账'].includes(status)) {
      skippedCount++;
      continue;
    }

    // 解析金额（去掉 ¥ 符号）
    const amount = parseFloat(amountStr.replace(/[¥￥,]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      skippedCount++;
      continue;
    }

    // 解析交易方向
    let direction: 'income' | 'expense' | 'other' = 'other';
    if (directionStr === '支出') direction = 'expense';
    else if (directionStr === '收入') direction = 'income';
    else direction = 'other'; // 不计收支

    // 解析时间
    const transactionTime = parseWechatTime(timeStr);

    transactions.push({
      platform: 'wechat',
      transactionTime,
      transactionType: type,
      counterparty: counterparty || '',
      description: description || '',
      direction,
      amount,
      paymentMethod,
      status: status || '',
      transactionId: transactionId || `wechat_${Date.now()}_${Math.random()}`,
      merchantOrderId: merchantOrderId !== '/' ? merchantOrderId : undefined,
      note: note !== '/' ? note : undefined,
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
    platform: 'wechat',
    transactions,
    skippedCount,
    errors,
    dateRange,
  };
}

/** 微信时间格式：2025-01-15 12:30:45 → ISO */
function parseWechatTime(timeStr: string): string {
  // 微信时间格式已经是标准格式，可以直接解析
  const d = new Date(timeStr.replace(/\//g, '-'));
  if (isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}
