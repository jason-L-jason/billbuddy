// ====== 数据源平台 ======
export type Platform = 'wechat' | 'alipay';
export type EcommercePlatform = 'taobao' | 'jd' | 'pdd';

// ====== 交易方向 ======
export type TransactionDirection = 'income' | 'expense' | 'other';

// ====== 分类类别（13 类） ======
export type CategoryType =
  | '餐饮'
  | '日用百货'
  | '交通出行'
  | '居住'
  | '服饰美妆'
  | '数码电子'
  | '娱乐'
  | '医疗健康'
  | '教育学习'
  | '通讯'
  | '金融理财'
  | '转账红包'
  | '公务报销'
  | '未分类';

// ====== 分类来源 ======
export type ClassifySource = 'rule' | 'llm' | 'manual';

// ====== 匹配方式 ======
export type MatchMethod = 'order_id' | 'amount_time' | 'manual';

// ====== 分类结果 ======
export interface ClassifyResult {
  category: CategoryType;
  confidence: number;
  source: ClassifySource;
  reason?: string;
}

// ====== 分类器接口 ======
export interface IClassifier {
  classify(transaction: Transaction): Promise<ClassifyResult>;
  readonly name: string;
  readonly isAvailable: boolean;
}

// ====== 电商商品明细 ======
export interface EcommerceItem {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  actualPaid: number;
  shopName?: string;
}

// ====== 电商订单匹配信息 ======
export interface EcommerceMatch {
  platform: EcommercePlatform;
  orderId: string;
  items: EcommerceItem[];
  matchMethod: MatchMethod;
  matchConfidence: number;
}

// ====== 核心交易记录 ======
export interface Transaction {
  id?: number;
  platform: Platform;
  transactionTime: string;       // ISO 格式
  transactionType?: string;      // 原始交易类型
  counterparty: string;          // 交易对方
  description: string;           // 商品/商品说明
  direction: TransactionDirection;
  amount: number;                // 正数
  paymentMethod?: string;        // 支付方式
  status: string;                // 交易状态
  transactionId: string;         // 交易单号
  merchantOrderId?: string;      // 商家订单号
  note?: string;                 // 备注
  alipayCategory?: string;       // 支付宝自带分类

  // 分类信息
  category: CategoryType;
  classifySource: ClassifySource;
  classifyConfidence: number;
  classifyReason?: string;

  // 电商匹配信息
  ecommerceMatch?: EcommerceMatch;

  // 元数据
  importBatchId: string;         // 导入批次 ID
  importTime: string;            // 导入时间
}

// ====== 淘宝订单 ======
export interface TaobaoOrder {
  id?: number;
  orderId: string;
  itemName: string;
  price: number;
  quantity: number;
  actualPaid: number;
  orderTime: string;
  shopName?: string;
  status?: string;
  importBatchId: string;
  importTime: string;
}

// ====== 导入记录 ======
export interface ImportRecord {
  id?: number;
  batchId: string;
  fileName: string;
  platform: Platform | EcommercePlatform;
  recordCount: number;
  importTime: string;
  dateRange?: string;            // 如 "2025-01 ~ 2025-03"
}

// ====== 用户自定义规则 ======
export interface CustomRule {
  id?: number;
  field: 'counterparty' | 'description';
  keyword: string;
  category: CategoryType;
  createdAt: string;
}

// ====== 分类色值映射 ======
export const CATEGORY_COLORS: Record<CategoryType, string> = {
  '餐饮': '#EF6C57',
  '交通出行': '#38BDF8',
  '日用百货': '#FBBF24',
  '居住': '#8B5CF6',
  '服饰美妆': '#EC4899',
  '数码电子': '#3B82F6',
  '娱乐': '#10B981',
  '医疗健康': '#06B6D4',
  '教育学习': '#7C3AED',
  '通讯': '#6366F1',
  '金融理财': '#F59E0B',
  '转账红包': '#F43F5E',
  '公务报销': '#0EA5E9',
  '未分类': '#9CA3AF',
};

// ====== 所有分类列表 ======
export const ALL_CATEGORIES: CategoryType[] = [
  '餐饮', '日用百货', '交通出行', '居住', '服饰美妆',
  '数码电子', '娱乐', '医疗健康', '教育学习', '通讯',
  '金融理财', '转账红包', '公务报销', '未分类',
];
