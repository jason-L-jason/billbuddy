import React, { useState, useEffect } from 'react';
import { Button, Dialog, Input, Select, MessagePlugin, Popconfirm, Tag, Radio } from 'tdesign-react';
import { AddIcon, DeleteIcon, EditIcon, ChevronDownIcon, ChevronUpIcon } from 'tdesign-icons-react';
import { db } from '@/db';
import { CustomRule, CategoryType, ALL_CATEGORIES, CATEGORY_COLORS } from '@/types';
import { BUILTIN_RULES } from '@/core/classifier/rule-engine/builtin-rules';
import { useTransactionsStore } from '@/store/transactions';

const FIELD_LABELS: Record<string, string> = {
  counterparty: '交易对方',
  description: '商品说明',
};

const RuleManager: React.FC = () => {
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null);
  const [showBuiltin, setShowBuiltin] = useState(false);
  const { reclassifyAll } = useTransactionsStore();

  // 表单状态
  const [formField, setFormField] = useState<'counterparty' | 'description'>('counterparty');
  const [formKeyword, setFormKeyword] = useState('');
  const [formCategory, setFormCategory] = useState<CategoryType>('餐饮');
  const [saving, setSaving] = useState(false);

  const loadRules = async () => {
    const all = await db.customRules.toArray();
    setRules(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  useEffect(() => {
    loadRules();
  }, []);

  const resetForm = () => {
    setFormField('counterparty');
    setFormKeyword('');
    setFormCategory('餐饮');
    setEditingRule(null);
  };

  const openAdd = () => {
    resetForm();
    setShowAdd(true);
  };

  const openEdit = (rule: CustomRule) => {
    setFormField(rule.field);
    setFormKeyword(rule.keyword);
    setFormCategory(rule.category);
    setEditingRule(rule);
    setShowAdd(true);
  };

  const handleSave = async () => {
    const trimmed = formKeyword.trim();
    if (!trimmed) {
      MessagePlugin.warning('关键词不能为空');
      return;
    }

    setSaving(true);
    try {
      if (editingRule) {
        // 更新
        await db.customRules.update(editingRule.id!, {
          field: formField,
          keyword: trimmed,
          category: formCategory,
        });
        MessagePlugin.success('规则已更新');
      } else {
        // 检查重复
        const existing = await db.customRules
          .where({ field: formField, keyword: trimmed })
          .first();
        if (existing) {
          MessagePlugin.warning('已存在相同的规则');
          setSaving(false);
          return;
        }
        // 新建
        await db.customRules.add({
          field: formField,
          keyword: trimmed,
          category: formCategory,
          createdAt: new Date().toISOString(),
        });
        MessagePlugin.success('规则已创建');
      }

      setShowAdd(false);
      resetForm();
      await loadRules();

      // 自动触发重分类
      const { updated } = await reclassifyAll();
      if (updated > 0) {
        MessagePlugin.success(`规则已应用：${updated} 笔交易分类已更新`);
      }
    } catch (e) {
      console.error('保存规则失败:', e);
      MessagePlugin.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: CustomRule) => {
    try {
      await db.customRules.delete(rule.id!);
      MessagePlugin.success('规则已删除');
      await loadRules();

      const { updated } = await reclassifyAll();
      if (updated > 0) {
        MessagePlugin.info(`已重新分类 ${updated} 笔交易`);
      }
    } catch (e) {
      console.error('删除规则失败:', e);
      MessagePlugin.error('删除失败');
    }
  };

  // 内置规则统计
  const builtinCount = Object.values(BUILTIN_RULES).reduce(
    (sum, r) => sum + r.counterparty.length + r.description.length,
    0
  );

  return (
    <div className="space-y-4">
      {/* 自定义规则 */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            自定义规则
            {rules.length > 0 && (
              <span className="text-gray-400 font-normal ml-1">({rules.length})</span>
            )}
          </h4>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            自定义规则优先级高于内置规则
          </p>
        </div>
        <Button size="small" theme="primary" onClick={openAdd}>
          <AddIcon className="mr-1" />
          添加规则
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          <p className="text-2xl mb-2">📝</p>
          <p>还没有自定义规则</p>
          <p className="text-xs mt-1">修改交易分类时会自动提示创建规则</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 py-2.5 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg group"
            >
              <Tag size="small" variant="outline" theme="default">
                {FIELD_LABELS[rule.field]}
              </Tag>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                包含「<span className="font-medium text-gray-900 dark:text-gray-100">{rule.keyword}</span>」
              </span>
              <span className="text-gray-300 dark:text-gray-600">→</span>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[rule.category] }}
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">{rule.category}</span>
              </span>
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="small"
                  variant="text"
                  theme="default"
                  onClick={() => openEdit(rule)}
                >
                  <EditIcon size="14px" />
                </Button>
                <Popconfirm
                  content="删除后将对相关交易重新分类"
                  onConfirm={() => handleDelete(rule)}
                >
                  <Button size="small" variant="text" theme="danger">
                    <DeleteIcon size="14px" />
                  </Button>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 内置规则（可折叠） */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setShowBuiltin(!showBuiltin)}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer w-full"
        >
          {showBuiltin ? <ChevronUpIcon size="14px" /> : <ChevronDownIcon size="14px" />}
          <span>内置规则（{builtinCount} 条关键词）</span>
        </button>

        {showBuiltin && (
          <div className="mt-3 space-y-3 max-h-80 overflow-y-auto">
            {(Object.entries(BUILTIN_RULES) as [CategoryType, { counterparty: string[]; description: string[] }][]).map(
              ([category, ruleset]) => (
                <div key={category} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[category] }}
                    />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {category}
                    </span>
                  </div>
                  <div className="pl-4 flex flex-wrap gap-1">
                    {ruleset.counterparty.map((kw) => (
                      <Tag key={`cp-${kw}`} size="small" variant="light" theme="primary">
                        {kw}
                      </Tag>
                    ))}
                    {ruleset.description.map((kw) => (
                      <Tag key={`desc-${kw}`} size="small" variant="light" theme="default">
                        {kw}
                      </Tag>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      <Dialog
        visible={showAdd}
        header={editingRule ? '编辑规则' : '添加规则'}
        onClose={() => { setShowAdd(false); resetForm(); }}
        onConfirm={handleSave}
        confirmBtn={{ content: saving ? '保存中...' : '保存', loading: saving }}
        cancelBtn="取消"
        width={440}
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">匹配字段</p>
            <Radio.Group value={formField} onChange={(val) => setFormField(val as 'counterparty' | 'description')}>
              <Radio value="counterparty">
                <span className="text-sm">交易对方</span>
              </Radio>
              <Radio value="description">
                <span className="text-sm">商品说明</span>
              </Radio>
            </Radio.Group>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">关键词</p>
            <Input
              value={formKeyword}
              onChange={(val) => setFormKeyword(val as string)}
              placeholder="如：美团、外卖、星巴克"
              clearable
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">分类为</p>
            <Select
              value={formCategory}
              onChange={(val) => setFormCategory(val as CategoryType)}
              options={ALL_CATEGORIES.filter((c) => c !== '未分类').map((c) => ({
                label: c,
                value: c,
              }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default RuleManager;
