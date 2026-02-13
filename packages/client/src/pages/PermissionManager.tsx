import { useEffect, useState } from 'react';
import {
  Shield,
  Save,
  RefreshCw,
  Sparkles,
  CheckSquare,
  Square,
  Users,
  Lock,
} from 'lucide-react';
import api from '../api/client';
import { useStore } from '../store';

interface RolePermissions {
  [resource: string]: {
    [action: string]: boolean;
  };
}

const ROLES = ['admin', 'editor', 'viewer', 'approver'] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
  approver: 'Approver',
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access to all resources and settings',
  editor: 'Can create and modify rules, workflows, and data',
  viewer: 'Read-only access to all resources',
  approver: 'Can review and approve changes',
};

const RESOURCES = [
  'project',
  'ruleSet',
  'rule',
  'decisionTable',
  'workflow',
  'dataModel',
  'environment',
  'function',
  'report',
  'user',
] as const;

const ACTIONS = ['create', 'read', 'update', 'delete', 'publish', 'execute', 'approve'] as const;

const RESOURCE_LABELS: Record<string, string> = {
  project: 'Projects',
  ruleSet: 'Rule Sets',
  rule: 'Rules',
  decisionTable: 'Decision Tables',
  workflow: 'Workflows',
  dataModel: 'Data Models',
  environment: 'Environments',
  function: 'Functions',
  report: 'Reports',
  user: 'Users',
};

export function PermissionManager() {
  const { addNotification } = useStore();
  const [activeRole, setActiveRole] = useState<Role>('admin');
  const [permissions, setPermissions] = useState<Record<Role, RolePermissions>>({
    admin: {},
    editor: {},
    viewer: {},
    approver: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/permissions');
      const data = res.data.permissions || res.data || {};
      const merged: Record<Role, RolePermissions> = {
        admin: {},
        editor: {},
        viewer: {},
        approver: {},
      };
      for (const role of ROLES) {
        for (const resource of RESOURCES) {
          merged[role][resource] = {};
          for (const action of ACTIONS) {
            merged[role][resource][action] = data[role]?.[resource]?.[action] ?? false;
          }
        }
      }
      setPermissions(merged);
      setDirty(false);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load permissions' });
      // Initialize with empty permissions
      const empty: Record<Role, RolePermissions> = {
        admin: {},
        editor: {},
        viewer: {},
        approver: {},
      };
      for (const role of ROLES) {
        for (const resource of RESOURCES) {
          empty[role][resource] = {};
          for (const action of ACTIONS) {
            empty[role][resource][action] = false;
          }
        }
      }
      setPermissions(empty);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const togglePermission = (resource: string, action: string) => {
    setPermissions((prev) => ({
      ...prev,
      [activeRole]: {
        ...prev[activeRole],
        [resource]: {
          ...prev[activeRole][resource],
          [action]: !prev[activeRole][resource]?.[action],
        },
      },
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/permissions/${activeRole}`, {
        permissions: permissions[activeRole],
      });
      addNotification({ type: 'success', message: `${ROLE_LABELS[activeRole]} permissions saved` });
      setDirty(false);
    } catch {
      addNotification({ type: 'error', message: 'Failed to save permissions' });
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await api.post('/permissions/seed-defaults');
      addNotification({ type: 'success', message: 'Default permissions applied' });
      fetchPermissions();
    } catch {
      addNotification({ type: 'error', message: 'Failed to seed defaults' });
    }
  };

  const toggleAllForResource = (resource: string) => {
    const current = permissions[activeRole][resource] || {};
    const allChecked = ACTIONS.every((a) => current[a]);
    setPermissions((prev) => {
      const updated = { ...prev[activeRole][resource] };
      for (const action of ACTIONS) {
        updated[action] = !allChecked;
      }
      return {
        ...prev,
        [activeRole]: {
          ...prev[activeRole],
          [resource]: updated,
        },
      };
    });
    setDirty(true);
  };

  const toggleAllForAction = (action: string) => {
    const allChecked = RESOURCES.every(
      (r) => permissions[activeRole][r]?.[action],
    );
    setPermissions((prev) => {
      const updated = { ...prev[activeRole] };
      for (const resource of RESOURCES) {
        updated[resource] = {
          ...updated[resource],
          [action]: !allChecked,
        };
      }
      return { ...prev, [activeRole]: updated };
    });
    setDirty(true);
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
            <Shield className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Permission Manager</h1>
            <p className="text-sm text-slate-500">Role-based access control configuration</p>
          </div>
        </div>
        <button onClick={handleSeedDefaults} className="btn-secondary">
          <Sparkles className="w-4 h-4" />
          Seed Defaults
        </button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {ROLES.map((role) => (
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeRole === role
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      {/* Role description */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
          <Users className="w-4 h-4 text-brand-600" />
        </div>
        <div>
          <h3 className="font-medium text-sm text-slate-900">{ROLE_LABELS[activeRole]}</h3>
          <p className="text-xs text-slate-500">{ROLE_DESCRIPTIONS[activeRole]}</p>
        </div>
      </div>

      {/* Permission matrix */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-6 py-3 font-medium text-slate-500 min-w-[160px]">
                Resource
              </th>
              {ACTIONS.map((action) => (
                <th key={action} className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleAllForAction(action)}
                    className="font-medium text-slate-500 hover:text-brand-600 capitalize text-xs"
                  >
                    {action}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">All</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((resource) => {
              const resourcePerms = permissions[activeRole][resource] || {};
              const allChecked = ACTIONS.every((a) => resourcePerms[a]);
              return (
                <tr
                  key={resource}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-6 py-3 font-medium text-slate-900">
                    {RESOURCE_LABELS[resource]}
                  </td>
                  {ACTIONS.map((action) => (
                    <td key={action} className="px-4 py-3 text-center">
                      <button
                        onClick={() => togglePermission(resource, action)}
                        className="inline-flex"
                      >
                        {resourcePerms[action] ? (
                          <CheckSquare className="w-5 h-5 text-brand-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </button>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleAllForResource(resource)}
                      className="inline-flex"
                    >
                      {allChecked ? (
                        <CheckSquare className="w-4 h-4 text-brand-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between">
        <div>
          {dirty && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
        </div>
        <button
          onClick={handleSave}
          className="btn-primary"
          disabled={saving || !dirty}
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save {ROLE_LABELS[activeRole]} Permissions
        </button>
      </div>
    </div>
  );
}
