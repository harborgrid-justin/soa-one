import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Globe, Workflow, Users, Zap, Building2, Shield, Network,
  Code2, Activity, AlertTriangle, CheckCircle, BarChart3,
} from 'lucide-react';
import { getSOAMetrics } from '../api/client';
import type { SOADashboardData } from '../types';

export function SOADashboard() {
  const [data, setData] = useState<SOADashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSOAMetrics()
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

  const s = data?.summary;

  const statCards = [
    { label: 'Services', value: s?.totalServices ?? 0, sub: `${s?.activeServices ?? 0} active`, icon: Globe, color: 'text-blue-600 bg-blue-50', link: '/soa/services' },
    { label: 'Processes', value: s?.totalProcessDefinitions ?? 0, sub: `${s?.activeProcessInstances ?? 0} running`, icon: Workflow, color: 'text-emerald-600 bg-emerald-50', link: '/soa/processes' },
    { label: 'Tasks', value: s?.pendingTasks ?? 0, sub: `${s?.overdueTasks ?? 0} overdue`, icon: Users, color: 'text-violet-600 bg-violet-50', link: '/soa/tasks' },
    { label: 'CEP Rules', value: s?.totalCEPRules ?? 0, sub: `${s?.eventsProcessed ?? 0} events`, icon: Zap, color: 'text-amber-600 bg-amber-50', link: '/soa/cep' },
    { label: 'Partners', value: s?.totalPartners ?? 0, sub: `${s?.documentsExchanged ?? 0} docs`, icon: Building2, color: 'text-pink-600 bg-pink-50', link: '/soa/b2b' },
    { label: 'APIs', value: s?.totalAPIs ?? 0, sub: `${s?.publishedAPIs ?? 0} published`, icon: Code2, color: 'text-indigo-600 bg-indigo-50', link: '/soa/apis' },
    { label: 'Policies', value: s?.totalPolicies ?? 0, sub: `${s?.slaBreaches ?? 0} breaches`, icon: Shield, color: 'text-slate-600 bg-slate-50', link: '/soa/policies' },
    { label: 'Proxies', value: s?.totalProxies ?? 0, sub: `${s?.healthyProxies ?? 0} healthy`, icon: Network, color: 'text-teal-600 bg-teal-50', link: '/soa/mesh' },
    { label: 'KPIs', value: s?.totalKPIs ?? 0, sub: 'BAM tracking', icon: BarChart3, color: 'text-orange-600 bg-orange-50', link: '/soa/bam' },
    { label: 'Alerts', value: s?.activeAlerts ?? 0, sub: 'active', icon: AlertTriangle, color: s?.activeAlerts ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50', link: '/soa/monitoring' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          SOA Suite overview — service registry, BPEL processes, human tasks, CEP, B2B gateway, API management, policies, mesh, BAM, and monitoring.
        </p>
      </div>

      {/* Process Activity Banner */}
      <div className="card p-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 mb-1">Active Process Instances</div>
          <div className="text-4xl font-bold text-emerald-600">
            {s?.activeProcessInstances ?? 0}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {s?.completedProcessInstances ?? 0} completed / {s?.faultedProcessInstances ?? 0} faulted
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.totalServices ?? 0}</div>
            <div className="text-xs text-slate-500">Services</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.totalEndpoints ?? 0}</div>
            <div className="text-xs text-slate-500">Endpoints</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.apiRequestsTotal ?? 0}</div>
            <div className="text-xs text-slate-500">API Requests</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.patternsMatched ?? 0}</div>
            <div className="text-xs text-slate-500">CEP Matches</div>
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

      {/* Services & Processes Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Services</h2>
            <NavLink to="/soa/services" className="text-sm text-brand-600 hover:underline">View all</NavLink>
          </div>
          {data?.services && data.services.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.services.slice(0, 5).map((svc: any) => (
                <div key={svc.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{svc.name}</div>
                      <div className="text-xs text-slate-500">{svc.endpointCount} endpoints</div>
                    </div>
                  </div>
                  <span className={svc.status === 'active' ? 'badge-green' : 'text-xs text-slate-400'}>
                    {svc.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {svc.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No services registered yet.</div>
          )}
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Processes</h2>
            <NavLink to="/soa/processes" className="text-sm text-brand-600 hover:underline">View all</NavLink>
          </div>
          {data?.processes && data.processes.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.processes.slice(0, 5).map((proc: any) => (
                <div key={proc.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Workflow className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{proc.name}</div>
                      <div className="text-xs text-slate-500">v{proc.version}</div>
                    </div>
                  </div>
                  <span className={proc.status === 'active' ? 'badge-green' : 'text-xs text-slate-400'}>
                    {proc.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {proc.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No processes deployed yet.</div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { to: '/soa/services', label: 'Service Registry', desc: 'Register and discover services', icon: Globe, color: 'text-blue-600' },
          { to: '/soa/processes', label: 'BPEL Processes', desc: 'Orchestrate business processes', icon: Workflow, color: 'text-emerald-600' },
          { to: '/soa/tasks', label: 'Human Tasks', desc: 'Task management and workflow', icon: Users, color: 'text-violet-600' },
          { to: '/soa/cep', label: 'Event Processing', desc: 'Complex event patterns and rules', icon: Zap, color: 'text-amber-600' },
          { to: '/soa/b2b', label: 'B2B Gateway', desc: 'Partner and document exchange', icon: Building2, color: 'text-pink-600' },
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
