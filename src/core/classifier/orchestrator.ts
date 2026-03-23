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
    // 1. 检查用户自定义规则（单笔调用时从 DB 读取）
    const customRules = await db.customRules.toArray();
    const customResult = this.matchCustomRulesSync(transaction, customRules);
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

  /** 对多笔交易批量分类（预加载规则，避免 N 次 DB IO） */
  async classifyBatch(transactions: ParsedTransaction[]): Promise<ClassifyResult[]> {
    // 一次性预加载所有自定义规则到内存
    const customRules = await db.customRules.toArray();

    return Promise.all(
      transactions.map((t) => this.classifyWithRules(t, customRules))
    );
  }

  /** 使用预加载的规则对单笔交易分类（无额外 IO） */
  private async classifyWithRules(
    transaction: ParsedTransaction,
    customRules: CustomRule[]
  ): Promise<ClassifyResult> {
    // 1. 检查用户自定义规则
    const customResult = this.matchCustomRulesSync(transaction, customRules);
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

  /** 同步匹配自定义规则（纯内存操作） */
  private matchCustomRulesSync(
    transaction: ParsedTransaction,
    customRules: CustomRule[]
  ): ClassifyResult | null {
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
