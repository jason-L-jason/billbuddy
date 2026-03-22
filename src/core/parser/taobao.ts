import * as XLSX from 'xlsx';
import { TaobaoOrder } from '@/types';

/**
 * 淘宝订单 Excel 解析结果
 */
export interface TaobaoParseResult {
  orders: TaobaoOrder[];
  skippedCount: number;
  errors: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * 淘宝订单 Excel 解析器
 *
 * 淘宝导出的 Excel 字段：
 * 订单号, 订单提交时间, 订单状态, 店铺名称, 商品名称, 商品链接,
 * 型号款式, 商品数量, 商品金额, 实付金额, 运费,
 * 物流公司（当前仅支持未完结订单）, 物流单号（当前仅支持未完结订单）
 *
 * 注意：
 * - 同一订单号可能对应多行（多个商品），需要按订单号聚合
 * - 金额带 ￥ 前缀，需要清洗
 * - 最后一行可能是空行（NaN）
 * - 过滤"交易关闭"状态的订单
 */
export async function parseTaobaoExcel(file: File): Promise<TaobaoParseResult> {
  const errors: string[] = [];
  let skippedCount = 0;

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { orders: [], skippedCount: 0, errors: ['Excel 文件中没有工作表'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(
    sheet,
    { header: 1, defval: '', raw: false }
  );

  // 查找表头行
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rawData.length, 20); i++) {
    const row = rawData[i].map((cell) => String(cell ?? '').trim());
    if (row.includes('订单号') && row.includes('商品名称')) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      orders: [],
      skippedCount: 0,
      errors: ['无法识别淘宝订单格式：找不到包含"订单号"和"商品名称"的表头行'],
    };
  }

  // 建立字段索引
  const colIndex = (name: string): number => headers.indexOf(name);
  const idx = {
    orderId: colIndex('订单号'),
    orderTime: colIndex('订单提交时间'),
    status: colIndex('订单状态'),
    shopName: colIndex('店铺名称'),
    itemName: colIndex('商品名称'),
    sku: colIndex('型号款式'),
    quantity: colIndex('商品数量'),
    itemPrice: colIndex('商品金额'),
    actualPaid: colIndex('实付金额'),
    freight: colIndex('运费'),
  };

  const orders: TaobaoOrder[] = [];

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const cell = (index: number): string => {
      if (index < 0 || index >= row.length) return '';
      return String(row[index] ?? '').trim();
    };

    const orderId = cell(idx.orderId);
    const orderTime = cell(idx.orderTime);
    const status = cell(idx.status);
    const shopName = cell(idx.shopName);
    const itemName = cell(idx.itemName);
    const quantityStr = cell(idx.quantity);
    const itemPriceStr = cell(idx.itemPrice);
    const actualPaidStr = cell(idx.actualPaid);

    // 跳过空行（最后一行通常是 NaN）
    if (!orderId || orderId === 'nan' || orderId === 'NaN' || !itemName) {
      skippedCount++;
      continue;
    }

    // 过滤已取消/已关闭的订单
    if (status === '交易关闭') {
      skippedCount++;
      continue;
    }

    // 解析金额（去掉 ￥ 符号）
    const price = parseAmount(itemPriceStr);
    const actualPaid = parseAmount(actualPaidStr);
    const quantity = parseInt(quantityStr, 10) || 1;

    if (isNaN(actualPaid)) {
      errors.push(`第 ${i + 1} 行：无法解析实付金额 "${actualPaidStr}"`);
      skippedCount++;
      continue;
    }

    // 解析时间
    const isoTime = parseTaobaoTime(orderTime);

    orders.push({
      orderId,
      itemName,
      price: isNaN(price) ? actualPaid : price,
      quantity,
      actualPaid,
      orderTime: isoTime,
      shopName: shopName || undefined,
      status: status || undefined,
      importBatchId: '', // 入库时填充
      importTime: '',    // 入库时填充
    });
  }

  // 计算日期范围
  let dateRange: TaobaoParseResult['dateRange'];
  if (orders.length > 0) {
    const times = orders.map((o) => new Date(o.orderTime).getTime()).filter((t) => !isNaN(t));
    if (times.length > 0) {
      dateRange = {
        start: new Date(Math.min(...times)).toISOString(),
        end: new Date(Math.max(...times)).toISOString(),
      };
    }
  }

  return { orders, skippedCount, errors, dateRange };
}

/** 清洗金额字符串 → 数字 */
function parseAmount(str: string): number {
  if (!str) return NaN;
  return parseFloat(str.replace(/[¥￥,\s]/g, ''));
}

/** 淘宝时间 → ISO */
function parseTaobaoTime(timeStr: string): string {
  if (!timeStr) return new Date().toISOString();
  const d = new Date(timeStr.replace(/\//g, '-'));
  if (isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}
