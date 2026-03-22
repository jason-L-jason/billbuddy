import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import UploadPage from './components/Upload/UploadPage';
import DashboardPage from './components/Dashboard/DashboardPage';
import TransactionPage from './components/TransactionList/TransactionPage';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<UploadPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
