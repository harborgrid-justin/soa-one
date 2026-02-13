import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Notifications } from '../common/Notifications';
import { CommandPalette } from '../common/CommandPalette';
import { LoadingBar } from '../common/LoadingBar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useStore } from '../../store';

export function Layout() {
  const { sidebarOpen, mobileSidebarOpen, closeMobileSidebar, confirmDialog, hideConfirm } = useStore();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <LoadingBar />
      <Sidebar />

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-[72px]'} ml-0`}>
        <Header />
        <main className="p-6">
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <Notifications />
      <CommandPalette />

      {/* Global confirm dialog */}
      {confirmDialog && (
        <ConfirmDialog
          open={true}
          onCancel={hideConfirm}
          onConfirm={() => {
            confirmDialog.onConfirm();
            hideConfirm();
          }}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          confirmLabel={confirmDialog.confirmLabel}
        />
      )}
    </div>
  );
}
