import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <main className="pt-14 max-w-[1200px] mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
