import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <main className="pt-20 pb-6 sm:pb-8 max-w-[1200px] mx-auto px-4 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
