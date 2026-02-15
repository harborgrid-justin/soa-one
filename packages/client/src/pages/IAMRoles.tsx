import { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { getIAMRoles } from '../api/client';

export function IAMRoles() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIAMRoles().then(setRoles).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Role Management — define roles, permissions, constraints, and role hierarchy for RBAC.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Roles ({roles.length})</h2>
        </div>
        {roles.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {roles.map((role: any) => (
              <div key={role.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{role.name}</div>
                    <div className="text-xs text-slate-500">
                      {role.description ? (
                        <span>{role.description}</span>
                      ) : (
                        <span className="italic text-slate-400">No description</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {role.permissions?.length ?? 0} permissions
                  </span>
                  {role.inheritsFrom?.length > 0 && (
                    <span className="text-xs text-slate-400">
                      inherits from {role.inheritsFrom.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No roles defined yet.</div>
        )}
      </div>
    </div>
  );
}
