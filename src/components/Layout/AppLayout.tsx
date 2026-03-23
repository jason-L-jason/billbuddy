import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-page dark:bg-gray-950 transition-colors">
      <NavBar />
      {/* 桌面端 pt-20，移动端 pt-14 + pb-16（为底部 tab 留空间）*/}
      <main className="pt-14 sm:pt-20 pb-20 sm:pb-8 max-w-[1200px] mx-auto px-3 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
