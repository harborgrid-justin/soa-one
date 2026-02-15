import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users, UserCheck, KeyRound, Key, Globe, ShieldCheck, Shield,
  Vault, ShieldAlert, AlertTriangle,
} from 'lucide-react';
import { getIAMMetrics } from '../api/client';
import type { IAMMetricsSummary } from '../types';

export function IAMDashboard() {
  const [data, setData] = useState<IAMMetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIAMMetrics()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = data;

  const statCards = [
    { label: 'Identities', value: s?.totalIdentities ?? 0, sub: `${s?.activeIdentities ?? 0} active`, icon: Users, color: 'text-blue-600 bg-blue-50', link: '/iam/identities' },
    { label: 'Roles', value: s?.totalRoles ?? 0, sub: `${s?.totalPermissions ?? 0} permissions`, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50', link: '/iam/roles' },
    { label: 'Sessions', value: s?.activeSessions ?? 0, sub: 'active', icon: KeyRound, color: 'text-violet-600 bg-violet-50', link: '/iam/sessions' },
    { label: 'Tokens', value: s?.activeTokens ?? 0, sub: `${s?.tokensIssued ?? 0} issued`, icon: Key, color: 'text-amber-600 bg-amber-50', link: '/iam/tokens' },
    { label: 'Providers', value: s?.totalIdentityProviders ?? 0, sub: `${s?.federatedAuthenticationsTotal ?? 0} federated auths`, icon: Globe, color: 'text-pink-600 bg-pink-50', link: '/iam/federation' },
    { label: 'Campaigns', value: s?.activeCertificationCampaigns ?? 0, sub: 'active', icon: ShieldCheck, color: 'text-indigo-600 bg-indigo-50', link: '/iam/governance' },
    { label: 'SoD Policies', value: s?.totalSoDPolicies ?? 0, sub: `${s?.activeSoDViolations ?? 0} violations`, icon: Shield, color: 'text-slate-600 bg-slate-50', link: '/iam/governance' },
    { label: 'PAM Accounts', value: s?.totalPrivilegedAccounts ?? 0, sub: `${s?.activeCheckouts ?? 0} checkouts`, icon: Vault, color: 'text-teal-600 bg-teal-50', link: '/iam/pam' },
    { label: 'Risk', value: s?.averageRiskScore ?? 0, sub: `${s?.highRiskSessions ?? 0} high risk`, icon: ShieldAlert, color: 'text-orange-600 bg-orange-50', link: '/iam/risk' },
    { label: 'Alerts', value: s?.activeAlerts ?? 0, sub: 'active', icon: AlertTriangle, color: s?.activeAlerts ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50', link: '/iam/monitoring' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          Identity & Access Management — identities, authentication, authorization, federation, governance, privileged access, risk, and monitoring.
        </p>
      </div>

      {/* Authentication Activity Banner */}
      <div className="card p-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 mb-1">Authentication Activity</div>
          <div className="text-4xl font-bold text-emerald-600">
            {s?.authenticationsTotal ?? 0}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {s?.authenticationsSuccessful ?? 0} successful / {s?.authenticationsFailed ?? 0} failed
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.authenticationsTotal ?? 0}</div>
            <div className="text-xs text-slate-500">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.authenticationsSuccessful ?? 0}</div>
            <div className="text-xs text-slate-500">Successful</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.authenticationsFailed ?? 0}</div>
            <div className="text-xs text-slate-500">Failed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.mfaChallengesIssued ?? 0}</div>
            <div className="text-xs text-slate-500">MFA Challenges</div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <NavLink key={card.label} to={card.link} className="card p-4 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color} mb-2`}>
              <card.icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{card.sub}</div>
          </NavLink>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { to: '/iam/identities', label: 'Identities', desc: 'User and service identities', icon: Users, color: 'text-blue-600' },
          { to: '/iam/roles', label: 'Roles & Permissions', desc: 'RBAC and authorization', icon: UserCheck, color: 'text-emerald-600' },
          { to: '/iam/federation', label: 'Federation', desc: 'SSO and identity providers', icon: Globe, color: 'text-pink-600' },
          { to: '/iam/governance', label: 'Governance', desc: 'Certification and SoD', icon: ShieldCheck, color: 'text-indigo-600' },
          { to: '/iam/pam', label: 'Privileged Access', desc: 'Vault and checkout', icon: Vault, color: 'text-teal-600' },
        ].map((link) => (
          <NavLink key={link.to} to={link.to} className="card p-5 hover:shadow-md transition-shadow group">
            <link.icon className={`w-6 h-6 ${link.color} mb-2`} />
            <div className="font-medium text-slate-900 group-hover:text-brand-600 transition-colors">{link.label}</div>
            <div className="text-xs text-slate-500 mt-1">{link.desc}</div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
