import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DatePicker } from 'tdesign-react';
import { useTransactionsStore } from '@/store/transactions';

const NAV_ITEMS = [
  { path: '/', label: '导入' },
  { path: '/dashboard', label: '看板' },
  { path: '/transactions', label: '明细' },
];

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedMonth, setSelectedMonth } = useTransactionsStore();

  const handleMonthChange = (value: unknown) => {
    if (typeof value === 'string' && value) {
      // DatePicker month mode returns "YYYY-MM"
      setSelectedMonth(value);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-gray-200 flex items-center px-3 sm:px-6"
         style={{ backdropFilter: 'blur(12px)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4 sm:mr-8 cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
        <div className="w-8 h-8 rounded-r-md flex items-center justify-center text-white font-bold text-sm"
             style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
          B
        </div>
        <span className="text-base font-semibold text-gray-900 hidden sm:inline">BillBuddy</span>
      </div>

      {/* Nav Tabs */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-3 sm:px-4 py-2 rounded-r-sm text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-brand-light text-brand'
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
        <DatePicker
          mode="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          clearable={false}
          style={{ width: 140 }}
        />
      </div>
    </nav>
  );
};

export default NavBar;
