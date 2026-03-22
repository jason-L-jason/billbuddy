import { Transaction, CustomRule } from '@/types';
import { ParsedTransaction } from '../parser/types';
import { ClassifyResult } from './types';
import { ruleClassifier } from './rule-engine';
import { db } from '@/db';

/**
 * 分类调度器
 *
 * 第一期只有规则引擎路径：
 * 1. 检查用户自定义规则（最高优先级）
 * 2. 调用 RuleClassifier
 * 3. 无法分类的标记"未分类"
 */
export class ClassifierOrchestrator {
  /** 对一笔交易进行分类 */
  async classify(transaction: ParsedTransaction): Promise<ClassifyResult> {
    // 1. 检查用户自定义规则
    const customResult = await this.matchCustomRules(transaction);
    if (customResult) {
      return customResult;
    }

    // 2. 调用规则引擎
    return ruleClassifier.classify({
      counterparty: transaction.counterparty,
      description: transaction.description,
      alipayCategory: transaction.alipayCategory,
      platform: transaction.platform,
    });
  }

  /** 对多笔交易批量分类 */
  async classifyBatch(transactions: ParsedTransaction[]): Promise<ClassifyResult[]> {
    return Promise.all(transactions.map((t) => this.classify(t)));
  }

  /** 匹配用户自定义规则 */
  private async matchCustomRules(
    transaction: ParsedTransaction
  ): Promise<ClassifyResult | null> {
    const customRules = await db.customRules.toArray();

    for (const rule of customRules) {
      const fieldValue =
        rule.field === 'counterparty'
          ? transaction.counterparty
          : transaction.description;

      if (fieldValue.toLowerCase().includes(rule.keyword.toLowerCase())) {
        return {
          category: rule.category,
          confidence: 1.0,
          source: 'rule',
          reason: `自定义规则：${rule.field} 包含"${rule.keyword}"`,
        };
      }
    }

    return null;
  }
}

export const classifierOrchestrator = new ClassifierOrchestrator();
