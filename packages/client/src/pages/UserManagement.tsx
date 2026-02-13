import { useEffect, useState } from 'react';
import {
  Users, UserPlus, Shield, Mail, MoreVertical, Key,
  Check, X, Lock, Unlock, Crown,
} from 'lucide-react';
import { getUsers, inviteUser, updateUserRole, deactivateUser, getInvitations, getSsoConfig, updateSsoConfig } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const ROLE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  admin: { label: 'Admin', color: 'badge-red', icon: Crown },
  editor: { label: 'Editor', color: 'badge-blue', icon: Key },
  viewer: { label: 'Viewer', color: 'badge-gray', icon: Shield },
};

export function UserManagement() {
  const [tab, setTab] = useState<'users' | 'invitations' | 'sso'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [ssoConfig, setSsoConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const { addNotification } = useStore();

  const loadUsers = () => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadInvitations = () => {
    getInvitations().then(setInvitations).catch(() => {});
  };

  const loadSso = () => {
    getSsoConfig().then(setSsoConfig).catch(() => {});
  };

  useEffect(() => {
    loadUsers();
    loadInvitations();
    loadSso();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await inviteUser({ email: inviteEmail.trim(), role: inviteRole });
      addNotification({ type: 'success', message: `Invitation sent to ${inviteEmail}` });
      setShowInvite(false);
      setInviteEmail('');
      loadInvitations();
    } catch {
      addNotification({ type: 'error', message: 'Failed to send invitation' });
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateUserRole(userId, role);
      addNotification({ type: 'success', message: 'Role updated' });
      loadUsers();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update role' });
    }
  };

  const handleDeactivate = async (userId: string, name: string) => {
    if (!confirm(`Deactivate user "${name}"? They will lose access.`)) return;
    try {
      await deactivateUser(userId);
      addNotification({ type: 'success', message: `User "${name}" deactivated` });
      loadUsers();
    } catch {
      addNotification({ type: 'error', message: 'Failed to deactivate user' });
    }
  };

  const handleSsoUpdate = async (field: string, value: any) => {
    try {
      await updateSsoConfig({ [field]: value });
      addNotification({ type: 'success', message: 'SSO configuration updated' });
      loadSso();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update SSO config' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage team members, roles, and authentication settings.</p>
        <button onClick={() => setShowInvite(true)} className="btn-primary btn-sm">
          <UserPlus className="w-3.5 h-3.5" /> Invite User
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { id: 'users', label: 'Team Members', icon: Users },
          { id: 'invitations', label: 'Invitations', icon: Mail },
          { id: 'sso', label: 'SSO / LDAP', icon: Lock },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="card">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 font-medium text-slate-500">User</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-500">Role</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-500">Status</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-500">Last Login</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.viewer;
                    return (
                      <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-sm font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{user.name}</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <select
                            className="input py-1 w-28 text-xs"
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          >
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </td>
                        <td className="px-6 py-3">
                          <span className={user.isActive ? 'badge-green' : 'badge-red'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs text-slate-500">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-6 py-3">
                          {user.isActive && (
                            <button
                              onClick={() => handleDeactivate(user.id, user.name)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No team members found.
            </div>
          )}
        </div>
      )}

      {tab === 'invitations' && (
        <div className="card">
          {invitations.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {invitations.map((inv) => (
                <div key={inv.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{inv.email}</div>
                    <div className="text-xs text-slate-500">
                      Role: {inv.role} | Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="badge-yellow">Pending</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No pending invitations.
            </div>
          )}
        </div>
      )}

      {tab === 'sso' && (
        <div className="space-y-6 max-w-2xl">
          {/* SAML SSO */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">SAML Single Sign-On</h3>
                <p className="text-sm text-slate-500">Configure SAML 2.0 SSO with your identity provider.</p>
              </div>
              <button
                onClick={() => handleSsoUpdate('ssoEnabled', !ssoConfig?.ssoEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ssoConfig?.ssoEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ssoConfig?.ssoEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {ssoConfig?.ssoEnabled && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div>
                  <label className="label">Entity ID / Issuer URL</label>
                  <input className="input" placeholder="https://your-idp.com/metadata" />
                </div>
                <div>
                  <label className="label">SSO Login URL</label>
                  <input className="input" placeholder="https://your-idp.com/sso/saml" />
                </div>
                <div>
                  <label className="label">X.509 Certificate</label>
                  <textarea className="input min-h-[80px] font-mono text-xs" placeholder="-----BEGIN CERTIFICATE-----" />
                </div>
                <button className="btn-primary btn-sm">Save SAML Config</button>
              </div>
            )}
          </div>

          {/* LDAP */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">LDAP / Active Directory</h3>
                <p className="text-sm text-slate-500">Authenticate users against your LDAP directory.</p>
              </div>
              <button
                onClick={() => handleSsoUpdate('ldapEnabled', !ssoConfig?.ldapEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ssoConfig?.ldapEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ssoConfig?.ldapEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {ssoConfig?.ldapEnabled && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Host</label>
                    <input className="input" placeholder="ldap.company.com" />
                  </div>
                  <div>
                    <label className="label">Port</label>
                    <input className="input" placeholder="389" />
                  </div>
                </div>
                <div>
                  <label className="label">Base DN</label>
                  <input className="input" placeholder="dc=company,dc=com" />
                </div>
                <div>
                  <label className="label">Bind DN</label>
                  <input className="input" placeholder="cn=admin,dc=company,dc=com" />
                </div>
                <div>
                  <label className="label">Bind Password</label>
                  <input className="input" type="password" />
                </div>
                <button className="btn-primary btn-sm">Save LDAP Config</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member">
        <div className="space-y-4">
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="admin">Admin — full access</option>
              <option value="editor">Editor — create and edit rules</option>
              <option value="viewer">Viewer — read-only access</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleInvite} className="btn-primary" disabled={!inviteEmail.trim()}>Send Invitation</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
