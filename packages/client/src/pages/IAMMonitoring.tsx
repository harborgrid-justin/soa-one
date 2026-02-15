import { useEffect, useState } from 'react';
import { Activity, ScanEye, AlertTriangle } from 'lucide-react';
import { getIAMMetrics } from '../api/client';

export function IAMMonitoring() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIAMMetrics().then(setMetrics).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">IAM Monitoring — real-time metrics, alerts, audit trail, and system health for all IAM subsystems.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Identity Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Identities</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.totalIdentities || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Active Identities</div>
            <div className="text-2xl font-semibold text-green-600">{metrics?.activeIdentities || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Suspended Identities</div>
            <div className="text-2xl font-semibold text-orange-600">{metrics?.suspendedIdentities || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Locked Identities</div>
            <div className="text-2xl font-semibold text-red-600">{metrics?.lockedIdentities || 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Authentication Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Authentications</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.authenticationsTotal || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Successful</div>
            <div className="text-2xl font-semibold text-green-600">{metrics?.authenticationsSuccessful || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Failed</div>
            <div className="text-2xl font-semibold text-red-600">{metrics?.authenticationsFailed || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Active Sessions</div>
            <div className="text-2xl font-semibold text-blue-600">{metrics?.activeSessions || 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Authorization Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Roles</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.totalRoles || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Policies</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.totalPolicies || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Authorization Decisions</div>
            <div className="text-2xl font-semibold text-blue-600">{metrics?.authorizationDecisions || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Authorization Denials</div>
            <div className="text-2xl font-semibold text-red-600">{metrics?.authorizationDenials || 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Token Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Tokens Issued</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.tokensIssued || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Tokens Revoked</div>
            <div className="text-2xl font-semibold text-orange-600">{metrics?.tokensRevoked || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Active Tokens</div>
            <div className="text-2xl font-semibold text-green-600">{metrics?.activeTokens || 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Federation Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Identity Providers</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.totalIdentityProviders || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Federated Authentications</div>
            <div className="text-2xl font-semibold text-blue-600">{metrics?.federatedAuthenticationsTotal || 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Governance Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Active Certification Campaigns</div>
            <div className="text-2xl font-semibold text-indigo-600">{metrics?.activeCertificationCampaigns || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Total SoD Policies</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.totalSoDPolicies || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Pending Access Requests</div>
            <div className="text-2xl font-semibold text-amber-600">{metrics?.pendingAccessRequests || 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">PAM Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Privileged Accounts</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.totalPrivilegedAccounts || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Active Checkouts</div>
            <div className="text-2xl font-semibold text-teal-600">{metrics?.activeCheckouts || 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Risk Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">Average Risk Score</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.averageRiskScore || 0}</div>
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${
                (metrics?.averageRiskScore || 0) > 70 ? 'bg-red-500' :
                (metrics?.averageRiskScore || 0) > 40 ? 'bg-orange-500' :
                'bg-green-500'
              }`} style={{ width: `${metrics?.averageRiskScore || 0}%` }} />
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Anomalies Detected</div>
            <div className="text-2xl font-semibold text-red-600">{metrics?.anomaliesDetected || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Active Threat Indicators</div>
            <div className="text-2xl font-semibold text-red-600">{metrics?.activeThreatIndicators || 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            System Health
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <div>
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Active Alerts
            </div>
            <div className="text-2xl font-semibold text-orange-600">{metrics?.activeAlerts || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
              <ScanEye className="w-3 h-3" />
              Uptime
            </div>
            <div className="text-2xl font-semibold text-green-600">{formatUptime(metrics?.uptimeMs || 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
