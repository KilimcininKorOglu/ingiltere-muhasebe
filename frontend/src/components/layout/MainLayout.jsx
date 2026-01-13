import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { SidebarContext } from './Sidebar';

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen bg-dark-950">
        <Sidebar />
        <main
          className={`
            transition-all duration-300 ease-in-out
            min-h-screen
            pt-4 pb-8 px-4 lg:px-8
            ${collapsed ? 'lg:ml-20' : 'lg:ml-64'}
          `}
        >
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
};

export default MainLayout;
