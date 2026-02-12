import { useEffect, useState } from 'react';
import {
  CalendarClock,
  Plus,
  Play,
  ToggleLeft,
  ToggleRight,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Hash,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import api, { getRuleSets, getWorkflows } from '../api/client';
import { useStore } from '../store';

interface ScheduledJob {
  id: string;
  name: string;
  entityType: 'ruleSet' | 'workflow';
  entityId: string;
  entityName: string;
  cronExpression: string;
  timezone: string;
  input: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'error' | null;
  runCount: number;
  createdAt: string;
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

function parseCronToHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (minute === '*' && hour === '*') return 'Every minute';
  if (minute === '0' && hour === '*') return 'Every hour';
  if (minute === '*/5') return 'Every 5 minutes';
  if (minute === '*/15') return 'Every 15 minutes';
  if (minute === '*/30') return 'Every 30 minutes';
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*') {
    if (dayOfWeek === '*') return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    if (dayOfWeek === '1-5') return `Weekdays at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    if (dayOfWeek === '0') return `Sundays at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  if (dayOfMonth !== '*' && month === '*') {
    return `Monthly on day ${dayOfMonth} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  return cron;
}

export function ScheduledJobs() {
  const { addNotification } = useStore();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEntityType, setFormEntityType] = useState<'ruleSet' | 'workflow'>('ruleSet');
  const [formEntityId, setFormEntityId] = useState('');
  const [formCron, setFormCron] = useState('0 * * * *');
  const [formTimezone, setFormTimezone] = useState('UTC');
  const [formInput, setFormInput] = useState('{}');

  const fetchJobs = () => {
    setLoading(true);
    api
      .get('/scheduled-jobs')
      .then((r) => setJobs(r.data.jobs || r.data || []))
      .catch(() => {
        setJobs([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchJobs();
    getRuleSets()
      .then((data) => setRuleSets(data.ruleSets || data || []))
      .catch(() => {});
    getWorkflows()
      .then((data) => setWorkflows(data.workflows || data || []))
      .catch(() => {});
  }, []);

  const handleCreate = () => {
    if (!formName.trim() || !formEntityId) {
      addNotification({ type: 'error', message: 'Name and entity are required' });
      return;
    }
    try {
      JSON.parse(formInput);
    } catch {
      addNotification({ type: 'error', message: 'Input must be valid JSON' });
      return;
    }

    api
      .post('/scheduled-jobs', {
        name: formName,
        entityType: formEntityType,
        entityId: formEntityId,
        cronExpression: formCron,
        timezone: formTimezone,
        input: formInput,
      })
      .then(() => {
        addNotification({ type: 'success', message: 'Scheduled job created' });
        setShowCreateModal(false);
        resetForm();
        fetchJobs();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to create scheduled job' });
      });
  };

  const resetForm = () => {
    setFormName('');
    setFormEntityType('ruleSet');
    setFormEntityId('');
    setFormCron('0 * * * *');
    setFormTimezone('UTC');
    setFormInput('{}');
  };

  const toggleJob = (jobId: string, currentEnabled: boolean) => {
    api
      .put(`/scheduled-jobs/${jobId}`, { enabled: !currentEnabled })
      .then(() => {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, enabled: !currentEnabled } : j))
        );
        addNotification({
          type: 'success',
          message: `Job ${!currentEnabled ? 'enabled' : 'disabled'}`,
        });
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to update job' });
      });
  };

  const runNow = (jobId: string) => {
    api
      .post(`/scheduled-jobs/${jobId}/run`)
      .then(() => {
        addNotification({ type: 'success', message: 'Job triggered successfully' });
        fetchJobs();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to trigger job' });
      });
  };

  const deleteJob = (jobId: string) => {
    api
      .delete(`/scheduled-jobs/${jobId}`)
      .then(() => {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        addNotification({ type: 'success', message: 'Job deleted' });
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to delete job' });
      });
  };

  const entityOptions = formEntityType === 'ruleSet' ? ruleSets : workflows;

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
            <CalendarClock className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Scheduled Jobs</h1>
            <p className="text-sm text-slate-500">Automate rule set and workflow executions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchJobs} className="btn-secondary btn-sm" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Job
          </button>
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-4">
        {jobs.length > 0 ? (
          jobs.map((job) => (
            <div key={job.id} className="card p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      job.enabled ? 'bg-brand-50' : 'bg-slate-100'
                    }`}
                  >
                    <CalendarClock
                      className={`w-5 h-5 ${job.enabled ? 'text-brand-600' : 'text-slate-400'}`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-slate-900">{job.name}</h4>
                      <span className={job.enabled ? 'badge-green' : 'badge-gray'}>
                        {job.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className="badge-blue">{job.entityType === 'ruleSet' ? 'Rule Set' : 'Workflow'}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{job.entityName}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Cron Expression</div>
                        <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5 font-mono text-slate-700">
                          {job.cronExpression}
                        </code>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {parseCronToHuman(job.cronExpression)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Next Run</div>
                        <div className="flex items-center gap-1 text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {job.nextRunAt
                            ? new Date(job.nextRunAt).toLocaleString()
                            : 'Not scheduled'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Last Run</div>
                        <div className="flex items-center gap-1">
                          {job.lastRunStatus === 'success' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          ) : job.lastRunStatus === 'error' ? (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span className="text-slate-700">
                            {job.lastRunAt
                              ? new Date(job.lastRunAt).toLocaleString()
                              : 'Never'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Run Count</div>
                        <div className="flex items-center gap-1 text-slate-700">
                          <Hash className="w-3.5 h-3.5 text-slate-400" />
                          {job.runCount}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => runNow(job.id)}
                    className="btn-secondary btn-sm"
                    title="Run Now"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Run Now
                  </button>
                  <button
                    onClick={() => toggleJob(job.id, job.enabled)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    title={job.enabled ? 'Disable' : 'Enable'}
                  >
                    {job.enabled ? (
                      <ToggleRight className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteJob(job.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="card px-6 py-16 text-center">
            <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Scheduled Jobs</h3>
            <p className="text-sm text-slate-500 mb-4">
              Create a scheduled job to automate rule set or workflow executions.
            </p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" />
              Create Job
            </button>
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Scheduled Job"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Job Name</label>
            <input
              className="input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Nightly Risk Assessment"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Entity Type</label>
              <select
                className="input"
                value={formEntityType}
                onChange={(e) => {
                  setFormEntityType(e.target.value as 'ruleSet' | 'workflow');
                  setFormEntityId('');
                }}
              >
                <option value="ruleSet">Rule Set</option>
                <option value="workflow">Workflow</option>
              </select>
            </div>
            <div>
              <label className="label">
                Select {formEntityType === 'ruleSet' ? 'Rule Set' : 'Workflow'}
              </label>
              <select
                className="input"
                value={formEntityId}
                onChange={(e) => setFormEntityId(e.target.value)}
              >
                <option value="">Choose...</option>
                {entityOptions.map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cron Expression</label>
              <input
                className="input font-mono text-sm"
                value={formCron}
                onChange={(e) => setFormCron(e.target.value)}
                placeholder="0 * * * *"
              />
              <p className="text-xs text-slate-400 mt-1">
                {parseCronToHuman(formCron)}
              </p>
            </div>
            <div>
              <label className="label">Timezone</label>
              <select
                className="input"
                value={formTimezone}
                onChange={(e) => setFormTimezone(e.target.value)}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Input (JSON)</label>
            <textarea
              className="input font-mono text-xs min-h-[100px]"
              value={formInput}
              onChange={(e) => setFormInput(e.target.value)}
              placeholder='{"key": "value"}'
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button onClick={handleCreate} className="btn-primary">
              <CalendarClock className="w-4 h-4" />
              Create Job
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
