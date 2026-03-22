import { CategoryType, ClassifySource } from '@/types';

export interface ClassifyResult {
  category: CategoryType;
  confidence: number;
  source: ClassifySource;
  reason?: string;
}

export interface IClassifier {
  classify(transaction: {
    counterparty: string;
    description: string;
    alipayCategory?: string;
    platform: string;
  }): Promise<ClassifyResult>;
  readonly name: string;
  readonly isAvailable: boolean;
}
