import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Select } from 'tdesign-react';
import { useTransactionsStore } from '@/store/transactions';
import { useThemeStore } from '@/store/theme';
import { formatMonth } from '@/utils/format';

const NAV_ITEMS = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/transactions', label: '明细', icon: '📋' },
  { path: '/report', label: '报告', icon: '📊' },
  { path: '/settings', label: '设置', icon: '⚙️' },
];

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedMonth, setSelectedMonth, availableMonths, initMonth } = useTransactionsStore();
  const { isDark, toggle } = useThemeStore();

  useEffect(() => {
    initMonth();
  }, [initMonth]);

  const monthOptions = availableMonths.length > 0
    ? availableMonths.map((m) => ({ label: formatMonth(m), value: m }))
    : [{ label: formatMonth(selectedMonth), value: selectedMonth }];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      {/* 桌面端顶部导航 */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/60 dark:border-gray-700/60 hidden sm:flex items-center px-3 sm:px-6"
           style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2 mr-8 cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
               style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
            B
          </div>
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100">BillBuddy</span>
        </div>

        {/* Nav Tabs */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive(item.path)
                  ? 'bg-brand-light dark:bg-brand/20 text-brand shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 右侧工具 */}
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          {/* 暗色模式 Toggle */}
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer text-sm"
            title={isDark ? '切换亮色模式' : '切换暗色模式'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* 月份选择器 */}
          <Select
            value={selectedMonth}
            onChange={(v) => setSelectedMonth(v as string)}
            options={monthOptions}
            style={{ width: 140 }}
            placeholder="选择月份"
          />
        </div>
      </nav>

      {/* 移动端顶部栏（简化） */}
      <div className="fixed top-0 left-0 right-0 z-50 h-12 bg-white/90 dark:bg-gray-900/90 border-b border-gray-200/60 dark:border-gray-700/60 flex sm:hidden items-center px-3 justify-between"
           style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs"
               style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
            B
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">BillBuddy</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer text-xs"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <Select
            value={selectedMonth}
            onChange={(v) => setSelectedMonth(v as string)}
            options={monthOptions}
            style={{ width: 120 }}
            size="small"
            placeholder="月份"
          />
        </div>
      </div>

      {/* 移动端底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 border-t border-gray-200/60 dark:border-gray-700/60 flex sm:hidden items-center justify-around h-14 safe-area-bottom"
           style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              isActive(item.path)
                ? 'text-brand'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};

export default NavBar;
