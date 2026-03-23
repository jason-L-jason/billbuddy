import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Select } from 'tdesign-react';
import { useTransactionsStore } from '@/store/transactions';

const NAV_ITEMS = [
  { path: '/', label: '首页' },
  { path: '/transactions', label: '明细' },
];

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${parseInt(m)}月`;
}

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedMonth, setSelectedMonth, availableMonths, initMonth } = useTransactionsStore();

  useEffect(() => {
    initMonth();
  }, [initMonth]);

  const monthOptions = availableMonths.length > 0
    ? availableMonths.map((m) => ({ label: formatMonthLabel(m), value: m }))
    : [{ label: formatMonthLabel(selectedMonth), value: selectedMonth }];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/80 border-b border-gray-200/60 flex items-center px-3 sm:px-6"
         style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4 sm:mr-8 cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
             style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
          B
        </div>
        <span className="text-base font-semibold text-gray-900 hidden sm:inline">BillBuddy</span>
      </div>

      {/* Nav Tabs */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-brand-light text-brand shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 月份选择器（右侧） */}
      <div className="ml-auto flex-shrink-0">
        <Select
          value={selectedMonth}
          onChange={(v) => setSelectedMonth(v as string)}
          options={monthOptions}
          style={{ width: 140 }}
          placeholder="选择月份"
        />
      </div>
    </nav>
  );
};

export default NavBar;
