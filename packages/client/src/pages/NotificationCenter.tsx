import { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  Trash2,
  CheckCheck,
  Clock,
} from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification as deleteNotificationApi,
} from '../api/client';
import { useStore } from '../store';

interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    border: 'border-l-emerald-500',
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-50',
    iconColor: 'text-red-500',
    border: 'border-l-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    border: 'border-l-amber-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    border: 'border-l-blue-500',
  },
};

type FilterTab = 'all' | 'unread';

export function NotificationCenter() {
  const { addNotification } = useStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const fetchNotifications = () => {
    setLoading(true);
    getNotifications()
      .then((data) => setNotifications(data.notifications || data || []))
      .catch(() => {
        // Use sample data for UI when API not available
        setNotifications([
          {
            id: '1',
            type: 'success',
            title: 'Rule Set Published',
            message: 'Premium Calculator v3 has been published successfully.',
            read: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          },
          {
            id: '2',
            type: 'warning',
            title: 'Approval Required',
            message: 'Risk Assessment rule set requires your approval before deployment.',
            read: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          },
          {
            id: '3',
            type: 'error',
            title: 'Execution Failed',
            message: 'Scheduled execution of Fraud Detection failed with timeout error.',
            read: true,
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          },
          {
            id: '4',
            type: 'info',
            title: 'New Team Member',
            message: 'Jane Smith has joined the workspace as a viewer.',
            read: true,
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          },
          {
            id: '5',
            type: 'success',
            title: 'Simulation Completed',
            message: 'What-if simulation "Q4 Scenarios" completed. 18/20 test cases passed.',
            read: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          },
        ]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const filteredNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    markNotificationRead(id).catch((err) => {
      console.error('Failed to mark notification as read', err);
      addNotification({ type: 'error', message: 'Failed to mark notification as read' });
    });
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsRead()
      .then(() => {
        addNotification({ type: 'success', message: 'All notifications marked as read' });
      })
      .catch((err) => {
        console.error('Failed to mark all notifications as read', err);
        addNotification({ type: 'error', message: 'Failed to mark all as read' });
      });
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotificationApi(id).catch((err) => {
      console.error('Failed to delete notification', err);
      addNotification({ type: 'error', message: 'Failed to delete notification' });
    });
  };

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <Bell className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-500">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary btn-sm">
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All Read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab('unread')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'unread'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notification list */}
      <div className="card">
        {filteredNotifications.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((notif) => {
              const config = typeConfig[notif.type];
              const Icon = config.icon;
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                  className={`px-6 py-4 flex items-start gap-4 border-l-4 transition-colors cursor-pointer hover:bg-slate-50/50 ${
                    config.border
                  } ${notif.read ? 'opacity-70' : ''}`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}
                  >
                    <Icon className={`w-4.5 h-4.5 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">{notif.title}</span>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-brand-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{notif.message}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(notif.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNotification(notif.id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <BellOff className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No notifications</h3>
            <p className="text-sm text-slate-500">
              {activeTab === 'unread'
                ? "You've read all your notifications."
                : "You don't have any notifications yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
