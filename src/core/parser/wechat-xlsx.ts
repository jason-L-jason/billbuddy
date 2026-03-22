import * as XLSX from 'xlsx';
import { ParseResult, ParsedTransaction } from './types';

/**
 * 微信账单 XLSX 解析器
 *
 * 微信近期的账单导出格式已改为 .xlsx（Excel），字段与 CSV 版本相同：
 * - 交易时间, 交易类型, 交易对方, 商品, 收/支, 金额(元), 支付方式, 当前状态, 交易单号, 商户单号, 备注
 * - 前面可能有说明行，需要自动跳过找到表头
 */
export async function parseWechatXLSX(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  let skippedCount = 0;

  // 读取文件为 ArrayBuffer
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // 取第一个 sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      platform: 'wechat',
      transactions: [],
      skippedCount: 0,
      errors: ['Excel 文件中没有工作表'],
    };
  }

  const sheet = workbook.Sheets[sheetName];

  // 把 sheet 转为二维数组，方便查找表头
  const rawData: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(
    sheet,
    { header: 1, defval: '' }
  );

  // 找到表头行（包含"交易时间"和"交易对方"的行）
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rawData.length, 30); i++) {
    const row = rawData[i].map((cell) => String(cell ?? '').trim());
    if (row.includes('交易时间') && row.includes('交易对方')) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      platform: 'wechat',
      transactions: [],
      skippedCount: 0,
      errors: ['无法识别微信账单格式：找不到表头行'],
    };
  }

  // 建立字段索引
  const colIndex = (name: string): number => headers.indexOf(name);
  const idx = {
    time: colIndex('交易时间'),
    type: colIndex('交易类型'),
    counterparty: colIndex('交易对方'),
    description: colIndex('商品'),
    direction: colIndex('收/支'),
    amount: colIndex('金额(元)'),
    paymentMethod: colIndex('支付方式'),
    status: colIndex('当前状态'),
    transactionId: colIndex('交易单号'),
    merchantOrderId: colIndex('商户单号'),
    note: colIndex('备注'),
  };

  const transactions: ParsedTransaction[] = [];

  // 从表头下一行开始遍历数据行
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const cell = (index: number): string => {
      if (index < 0 || index >= row.length) return '';
      return String(row[index] ?? '').trim();
    };

    const timeStr = cell(idx.time);
    const type = cell(idx.type);
    const counterparty = cell(idx.counterparty);
    const description = cell(idx.description);
    const directionStr = cell(idx.direction);
    const amountStr = cell(idx.amount);
    const paymentMethod = cell(idx.paymentMethod);
    const status = cell(idx.status);
    const transactionId = cell(idx.transactionId);
    const merchantOrderId = cell(idx.merchantOrderId);
    const note = cell(idx.note);

    // 跳过无效行
    if (!timeStr || !amountStr) {
      skippedCount++;
      continue;
    }

    // 过滤非正常交易
    const validStatuses = [
      '支付成功', '已收钱', '已转账', '已存入零钱',
      '充值完成', '提现已到账', '已全额退款', '对方已收钱',
    ];
    if (status && !validStatuses.includes(status)) {
      skippedCount++;
      continue;
    }

    // 解析金额（去掉 ¥ 符号和逗号）
    const amount = parseFloat(amountStr.replace(/[¥￥,\s]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      skippedCount++;
      continue;
    }

    // 解析交易方向
    let direction: 'income' | 'expense' | 'other' = 'other';
    if (directionStr === '支出') direction = 'expense';
    else if (directionStr === '收入') direction = 'income';

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
      merchantOrderId: merchantOrderId && merchantOrderId !== '/' ? merchantOrderId : undefined,
      note: note && note !== '/' ? note : undefined,
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

/** 微信时间格式：2025-01-15 12:30:45 或 2025/01/15 12:30:45 → ISO */
function parseWechatTime(timeStr: string): string {
  // Excel 中的日期可能是数字序列号（Excel serial date）
  if (/^\d+(\.\d+)?$/.test(timeStr)) {
    // Excel serial date → JS Date
    const excelEpoch = new Date(1899, 11, 30);
    const days = parseFloat(timeStr);
    const ms = excelEpoch.getTime() + days * 86400000;
    return new Date(ms).toISOString();
  }

  // 标准日期字符串
  const d = new Date(timeStr.replace(/\//g, '-'));
  if (isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}
