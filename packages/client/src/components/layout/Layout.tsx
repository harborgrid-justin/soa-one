import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Notifications } from '../common/Notifications';
import { useStore } from '../../store';

export function Layout() {
  const { sidebarOpen } = useStore();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-[72px]'}`}>
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
      <Notifications />
    </div>
  );
}
