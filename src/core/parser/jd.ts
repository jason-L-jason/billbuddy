import * as XLSX from 'xlsx';
import { JdOrder } from '@/types';

/**
 * 京东订单 Excel 解析结果
 */
export interface JdParseResult {
  orders: JdOrder[];
  skippedCount: number;
  errors: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * 京东订单 Excel 解析器
 *
 * 京东导出的订单 Excel 可能有多种格式：
 *
 * 格式 A（常见）：单 sheet，字段包括：
 *   订单号, 下单时间/订单提交时间, 订单状态, 店铺名称/商家名称,
 *   商品名称, 商品编码/SKU, 商品数量/数量, 商品单价/单价,
 *   实付金额/实付款/订单金额, 运费
 *
 * 格式 B（多 sheet）：
 *   Sheet 1: 订单主表（订单号, 下单日期, 总金额...）
 *   Sheet 2: 订单明细（订单号, 商品名称, 单价, 数量...）
 *
 * 解析策略：自适应检测表头，兼容多种字段名变体
 */
export async function parseJdExcel(file: File): Promise<JdParseResult> {
  const errors: string[] = [];
  let skippedCount = 0;

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (workbook.SheetNames.length === 0) {
    return { orders: [], skippedCount: 0, errors: ['Excel 文件中没有工作表'] };
  }

  // 尝试多 sheet 格式（有明细表的优先用明细表）
  const orders: JdOrder[] = [];

  // 策略：遍历所有 sheet，找到包含「订单号」和「商品名称」的 sheet
  let parsed = false;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawData: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(
      sheet,
      { header: 1, defval: '', raw: false }
    );

    const result = parseSheet(rawData, errors);
    if (result) {
      orders.push(...result.orders);
      skippedCount += result.skippedCount;
      parsed = true;
    }
  }

  if (!parsed) {
    return {
      orders: [],
      skippedCount: 0,
      errors: ['无法识别京东订单格式：找不到包含"订单号"和"商品名称"的表头行'],
    };
  }

  // 去重：同一订单号+商品名 只保留一条
  const uniqueKey = new Set<string>();
  const dedupedOrders: JdOrder[] = [];
  for (const order of orders) {
    const key = `${order.orderId}__${order.itemName}`;
    if (!uniqueKey.has(key)) {
      uniqueKey.add(key);
      dedupedOrders.push(order);
    }
  }

  // 计算日期范围
  let dateRange: JdParseResult['dateRange'];
  if (dedupedOrders.length > 0) {
    const times = dedupedOrders
      .map((o) => new Date(o.orderTime).getTime())
      .filter((t) => !isNaN(t));
    if (times.length > 0) {
      dateRange = {
        start: new Date(Math.min(...times)).toISOString(),
        end: new Date(Math.max(...times)).toISOString(),
      };
    }
  }

  return { orders: dedupedOrders, skippedCount, errors, dateRange };
}

/**
 * 解析单个 sheet
 */
function parseSheet(
  rawData: (string | number | undefined)[][],
  errors: string[]
): { orders: JdOrder[]; skippedCount: number } | null {
  // 查找表头行——包含「订单号」和「商品名称」（或近似字段名）
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rawData.length, 30); i++) {
    const row = rawData[i].map((cell) => String(cell ?? '').trim());
    // 京东订单必须有订单号，以及商品名/商品名称/商品信息
    const hasOrderId = row.some((h) => isOrderIdHeader(h));
    const hasItemName = row.some((h) => isItemNameHeader(h));
    if (hasOrderId && hasItemName) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) return null;

  // 建立灵活的字段索引
  const idx = {
    orderId: findHeaderIndex(headers, isOrderIdHeader),
    orderTime: findHeaderIndex(headers, isOrderTimeHeader),
    status: findHeaderIndex(headers, isStatusHeader),
    shopName: findHeaderIndex(headers, isShopNameHeader),
    itemName: findHeaderIndex(headers, isItemNameHeader),
    sku: findHeaderIndex(headers, isSkuHeader),
    quantity: findHeaderIndex(headers, isQuantityHeader),
    unitPrice: findHeaderIndex(headers, isUnitPriceHeader),
    actualPaid: findHeaderIndex(headers, isActualPaidHeader),
  };

  const orders: JdOrder[] = [];
  let skippedCount = 0;

  // 跟踪当前订单号（处理合并单元格：订单号只在第一行出现）
  let currentOrderId = '';
  let currentOrderTime = '';
  let currentStatus = '';
  let currentShopName = '';
  let currentActualPaid = NaN;

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const cell = (index: number): string => {
      if (index < 0 || index >= row.length) return '';
      return String(row[index] ?? '').trim();
    };

    // 订单号：可能因合并单元格为空，沿用上一行
    const rowOrderId = cell(idx.orderId);
    if (rowOrderId && rowOrderId !== 'nan' && rowOrderId !== 'NaN') {
      currentOrderId = rowOrderId;
      // 当订单号更新时，同步更新订单级字段
      currentOrderTime = idx.orderTime >= 0 ? cell(idx.orderTime) : currentOrderTime;
      currentStatus = idx.status >= 0 ? cell(idx.status) : currentStatus;
      currentShopName = idx.shopName >= 0 ? cell(idx.shopName) : currentShopName;
      currentActualPaid = idx.actualPaid >= 0 ? parseAmount(cell(idx.actualPaid)) : NaN;
    }

    if (!currentOrderId) {
      skippedCount++;
      continue;
    }

    const itemName = cell(idx.itemName);
    if (!itemName) {
      skippedCount++;
      continue;
    }

    // 过滤已取消/已关闭的订单
    if (currentStatus === '已取消' || currentStatus === '交易关闭') {
      skippedCount++;
      continue;
    }

    const quantityStr = cell(idx.quantity);
    const unitPriceStr = cell(idx.unitPrice);
    const rowActualPaidStr = cell(idx.actualPaid);

    const quantity = parseInt(quantityStr, 10) || 1;
    const unitPrice = parseAmount(unitPriceStr);
    const rowActualPaid = parseAmount(rowActualPaidStr);

    // 实付金额：优先用行级实付，否则用订单级实付，否则用单价*数量
    let actualPaid = !isNaN(rowActualPaid) ? rowActualPaid : NaN;
    if (isNaN(actualPaid) && !isNaN(currentActualPaid)) actualPaid = currentActualPaid;
    if (isNaN(actualPaid) && !isNaN(unitPrice)) actualPaid = unitPrice * quantity;

    if (isNaN(actualPaid)) {
      errors.push(`第 ${i + 1} 行：无法解析金额`);
      skippedCount++;
      continue;
    }

    const isoTime = parseJdTime(currentOrderTime);

    orders.push({
      orderId: currentOrderId,
      itemName,
      price: !isNaN(unitPrice) ? unitPrice : actualPaid,
      quantity,
      actualPaid,
      orderTime: isoTime,
      shopName: currentShopName || undefined,
      status: currentStatus || undefined,
      sku: cell(idx.sku) || undefined,
      importBatchId: '', // 入库时填充
      importTime: '',    // 入库时填充
    });
  }

  if (orders.length === 0) return null;
  return { orders, skippedCount };
}

// ====== 表头识别函数（兼容多种字段名变体）======

function isOrderIdHeader(h: string): boolean {
  return /^订单(号|编号|id)$/i.test(h) || h === '订单号';
}

function isOrderTimeHeader(h: string): boolean {
  return /下单(时间|日期)|订单(提交|创建)时间|订单时间|成交时间/.test(h);
}

function isStatusHeader(h: string): boolean {
  return /订单状态|状态/.test(h);
}

function isShopNameHeader(h: string): boolean {
  return /店铺名称|商家名称|商家|卖家/.test(h);
}

function isItemNameHeader(h: string): boolean {
  return /商品名称|商品名|商品信息|商品/.test(h);
}

function isSkuHeader(h: string): boolean {
  return /商品编码|sku|型号款式|规格/i.test(h);
}

function isQuantityHeader(h: string): boolean {
  return /商品数量|数量|购买数量/.test(h);
}

function isUnitPriceHeader(h: string): boolean {
  return /商品单价|单价|商品金额/.test(h);
}

function isActualPaidHeader(h: string): boolean {
  return /实付金额|实付款|应付金额|订单金额|总金额|总价/.test(h);
}

function findHeaderIndex(headers: string[], matcher: (h: string) => boolean): number {
  return headers.findIndex(matcher);
}

// ====== 工具函数 ======

/** 清洗金额字符串 → 数字 */
function parseAmount(str: string): number {
  if (!str) return NaN;
  return parseFloat(str.replace(/[¥￥,\s]/g, ''));
}

/** 京东时间 → ISO */
function parseJdTime(timeStr: string): string {
  if (!timeStr) return new Date().toISOString();
  const d = new Date(timeStr.replace(/\//g, '-'));
  if (isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}
