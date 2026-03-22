import { CategoryType } from '@/types';
import { IClassifier, ClassifyResult } from '../types';
import { BUILTIN_RULES, ALIPAY_CATEGORY_MAP } from './builtin-rules';

interface TransactionInput {
  counterparty: string;
  description: string;
  alipayCategory?: string;
  platform: string;
}

/**
 * 规则引擎分类器
 *
 * 三层分类策略：
 * 1. 支付宝自带分类直接映射（confidence: 0.95）
 * 2. 关键词规则匹配（confidence: 0.85）
 * 3. 未分类（confidence: 0）
 */
export class RuleClassifier implements IClassifier {
  readonly name = 'RuleClassifier';
  readonly isAvailable = true;

  async classify(transaction: TransactionInput): Promise<ClassifyResult> {
    // 第一层：利用支付宝自带分类
    if (transaction.platform === 'alipay' && transaction.alipayCategory) {
      const mapped = ALIPAY_CATEGORY_MAP[transaction.alipayCategory];
      if (mapped) {
        return {
          category: mapped,
          confidence: 0.95,
          source: 'rule',
          reason: `支付宝自带分类"${transaction.alipayCategory}"映射`,
        };
      }
    }

    // 第二层：关键词规则匹配
    const keywordResult = this.matchByKeyword(transaction);
    if (keywordResult) {
      return keywordResult;
    }

    // 第三层：未分类
    return {
      category: '未分类',
      confidence: 0,
      source: 'rule',
      reason: '无法匹配任何规则',
    };
  }

  private matchByKeyword(transaction: TransactionInput): ClassifyResult | null {
    const { counterparty, description } = transaction;
    const cpLower = counterparty.toLowerCase();
    const descLower = description.toLowerCase();

    for (const [category, rules] of Object.entries(BUILTIN_RULES)) {
      // 检查交易对方
      for (const keyword of rules.counterparty) {
        if (cpLower.includes(keyword.toLowerCase())) {
          return {
            category: category as CategoryType,
            confidence: 0.85,
            source: 'rule',
            reason: `交易对方包含关键词"${keyword}"`,
          };
        }
      }

      // 检查商品说明
      for (const keyword of rules.description) {
        if (descLower.includes(keyword.toLowerCase())) {
          return {
            category: category as CategoryType,
            confidence: 0.85,
            source: 'rule',
            reason: `商品说明包含关键词"${keyword}"`,
          };
        }
      }
    }

    return null;
  }
}

// 单例导出
export const ruleClassifier = new RuleClassifier();
