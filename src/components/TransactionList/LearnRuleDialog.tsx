import React, { useState, useMemo } from 'react';
import { Dialog, Radio, Input, MessagePlugin, Tag } from 'tdesign-react';
import { Transaction, CategoryType, CustomRule, CATEGORY_COLORS } from '@/types';
import { db } from '@/db';

interface Props {
  visible: boolean;
  transaction: Transaction | null;
  newCategory: CategoryType | null;
  onClose: () => void;
  onRuleCreated: () => void;
}

/**
 * 学习规则弹窗
 *
 * 当用户手动修改分类后弹出，提示创建自动规则：
 * - 选择匹配字段（交易对方 / 商品说明）
 * - 可编辑关键词
 * - 确认后写入 customRules 表
 * - 触发重分类
 */
const LearnRuleDialog: React.FC<Props> = ({
  visible,
  transaction,
  newCategory,
  onClose,
  onRuleCreated,
}) => {
  const [field, setField] = useState<'counterparty' | 'description'>('counterparty');
  const [keyword, setKeyword] = useState('');
  const [saving, setSaving] = useState(false);

  // 根据选择的字段自动填充关键词
  const defaultKeyword = useMemo(() => {
    if (!transaction) return '';
    return field === 'counterparty' ? transaction.counterparty : transaction.description;
  }, [transaction, field]);

  // 当字段切换时重置关键词
  const handleFieldChange = (val: string) => {
    const f = val as 'counterparty' | 'description';
    setField(f);
    setKeyword(f === 'counterparty' ? transaction?.counterparty || '' : transaction?.description || '');
  };

  // 弹窗打开时初始化
  React.useEffect(() => {
    if (visible && transaction) {
      setField('counterparty');
      setKeyword(transaction.counterparty);
    }
  }, [visible, transaction]);

  const handleConfirm = async () => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      MessagePlugin.warning('关键词不能为空');
      return;
    }
    if (!newCategory || !transaction) return;

    setSaving(true);
    try {
      // 检查是否已有相同规则
      const existing = await db.customRules
        .where({ field, keyword: trimmedKeyword })
        .first();

      if (existing) {
        if (existing.category === newCategory) {
          MessagePlugin.info('已存在相同的规则');
          onClose();
          return;
        }
        // 更新已有规则的分类
        await db.customRules.update(existing.id!, { category: newCategory });
        MessagePlugin.success(`已更新规则：${field === 'counterparty' ? '交易对方' : '商品说明'}包含「${trimmedKeyword}」→ ${newCategory}`);
      } else {
        // 创建新规则
        const rule: CustomRule = {
          field,
          keyword: trimmedKeyword,
          category: newCategory,
          createdAt: new Date().toISOString(),
        };
        await db.customRules.add(rule);
        MessagePlugin.success(`已创建规则：${field === 'counterparty' ? '交易对方' : '商品说明'}包含「${trimmedKeyword}」→ ${newCategory}`);
      }

      onRuleCreated();
      onClose();
    } catch (e) {
      console.error('创建规则失败:', e);
      MessagePlugin.error('创建规则失败');
    } finally {
      setSaving(false);
    }
  };

  if (!transaction || !newCategory) return null;

  const categoryColor = CATEGORY_COLORS[newCategory];

  return (
    <Dialog
      visible={visible}
      header="创建分类规则"
      onClose={onClose}
      onConfirm={handleConfirm}
      confirmBtn={{ content: saving ? '保存中...' : '创建规则并应用', loading: saving }}
      cancelBtn="跳过"
      width={480}
    >
      <div className="space-y-5 py-2">
        {/* 提示信息 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
          <span className="font-medium">💡 智能学习：</span>
          创建规则后，今后类似交易将自动归类为
          <Tag
            size="small"
            variant="light"
            style={{
              marginLeft: 4,
              marginRight: 4,
              color: categoryColor,
              borderColor: categoryColor,
              backgroundColor: `${categoryColor}15`,
            }}
          >
            {newCategory}
          </Tag>
          ，并对历史交易重新分类。
        </div>

        {/* 当前交易信息 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-16 flex-shrink-0">交易对方</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">{transaction.counterparty}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-16 flex-shrink-0">商品说明</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">{transaction.description}</span>
          </div>
        </div>

        {/* 匹配字段选择 */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">匹配字段</p>
          <Radio.Group value={field} onChange={(val) => handleFieldChange(val as string)}>
            <Radio value="counterparty">
              <span className="text-sm">交易对方</span>
              <span className="text-xs text-gray-400 ml-1">（如：美团、滴滴）</span>
            </Radio>
            <Radio value="description">
              <span className="text-sm">商品说明</span>
              <span className="text-xs text-gray-400 ml-1">（如：外卖、打车）</span>
            </Radio>
          </Radio.Group>
        </div>

        {/* 关键词编辑 */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">匹配关键词</p>
          <Input
            value={keyword}
            onChange={(val) => setKeyword(val as string)}
            placeholder="输入关键词"
            clearable
          />
          <p className="text-xs text-gray-400">
            当{field === 'counterparty' ? '交易对方' : '商品说明'}包含此关键词时，自动分类为「{newCategory}」
          </p>
        </div>
      </div>
    </Dialog>
  );
};

export default LearnRuleDialog;
