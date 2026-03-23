import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import HomePage from './components/Home/HomePage';
import TransactionPage from './components/TransactionList/TransactionPage';
import MonthlyReport from './components/Report/MonthlyReport';
import SettingsPage from './components/Settings/SettingsPage';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="transactions" element={<TransactionPage />} />
          <Route path="report" element={<MonthlyReport />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* 兼容旧路由：/dashboard 重定向到首页 */}
          <Route path="dashboard" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
