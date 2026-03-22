import React, { useState } from 'react';
import { Popup, Select } from 'tdesign-react';
import { ALL_CATEGORIES, CATEGORY_COLORS, CategoryType } from '@/types';

interface Props {
  category: CategoryType;
  onSelect?: (category: CategoryType) => void;
  clickable?: boolean;
}

const CategoryBadge: React.FC<Props> = ({ category, onSelect, clickable = true }) => {
  const [visible, setVisible] = useState(false);
  const color = CATEGORY_COLORS[category];
  const isUnclassified = category === '未分类';

  if (!clickable || !onSelect) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span
          className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className={isUnclassified ? 'text-gray-400' : 'text-gray-700'}>
          {category}
        </span>
      </span>
    );
  }

  return (
    <Popup
      visible={visible}
      onVisibleChange={setVisible}
      trigger="click"
      placement="bottom-left"
      content={
        <div className="p-2 max-h-60 overflow-y-auto" style={{ width: 160 }}>
          {ALL_CATEGORIES.filter((c) => c !== '未分类').map((cat) => (
            <button
              key={cat}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 text-sm text-left cursor-pointer"
              onClick={() => {
                onSelect(cat);
                setVisible(false);
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              <span>{cat}</span>
            </button>
          ))}
        </div>
      }
    >
      <button className="inline-flex items-center gap-1.5 text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className={isUnclassified ? 'text-gray-400' : 'text-gray-700'}>
          {isUnclassified ? '未分类 ✏️' : category}
        </span>
      </button>
    </Popup>
  );
};

export default CategoryBadge;
