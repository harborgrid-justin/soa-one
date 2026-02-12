import { useEffect, useState } from 'react';
import {
  CheckSquare,
  Plus,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Trash2,
  RefreshCw,
  GitBranch,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import api from '../api/client';
import { useStore } from '../store';

type Tab = 'requests' | 'pipelines';

interface ApprovalStage {
  name: string;
  status: 'pending' | 'approved' | 'rejected' | 'current';
  approvedBy?: string;
  approvedAt?: string;
}

interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  stages: ApprovalStage[];
  currentStage: number;
  createdAt: string;
  entityType: string;
  entityName: string;
}

interface PipelineStage {
  id: string;
  name: string;
  requiredRole: string;
}

interface Pipeline {
  id: string;
  name: string;
  description: string;
  stages: PipelineStage[];
  createdAt: string;
  activeRequests: number;
}

export function Approvals() {
  const { addNotification } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showCreatePipeline, setShowCreatePipeline] = useState(false);

  // Pipeline form
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDesc, setPipelineDesc] = useState('');
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([
    { id: '1', name: 'Review', requiredRole: 'reviewer' },
  ]);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/approvals/requests').catch(() => ({ data: { requests: [] } })),
      api.get('/approvals/pipelines').catch(() => ({ data: { pipelines: [] } })),
    ])
      .then(([reqRes, pipRes]) => {
        setRequests(reqRes.data.requests || reqRes.data || []);
        setPipelines(pipRes.data.pipelines || pipRes.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = (requestId: string) => {
    api
      .post(`/approvals/requests/${requestId}/approve`, { comment: commentText || undefined })
      .then(() => {
        addNotification({ type: 'success', message: 'Request approved' });
        setCommentText('');
        fetchData();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to approve request' });
      });
  };

  const handleReject = (requestId: string) => {
    api
      .post(`/approvals/requests/${requestId}/reject`, { comment: commentText || undefined })
      .then(() => {
        addNotification({ type: 'success', message: 'Request rejected' });
        setCommentText('');
        fetchData();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to reject request' });
      });
  };

  const addPipelineStage = () => {
    setPipelineStages([
      ...pipelineStages,
      {
        id: String(pipelineStages.length + 1),
        name: '',
        requiredRole: 'reviewer',
      },
    ]);
  };

  const removePipelineStage = (id: string) => {
    if (pipelineStages.length <= 1) return;
    setPipelineStages(pipelineStages.filter((s) => s.id !== id));
  };

  const updatePipelineStage = (id: string, field: keyof PipelineStage, value: string) => {
    setPipelineStages(pipelineStages.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleCreatePipeline = () => {
    if (!pipelineName.trim()) {
      addNotification({ type: 'error', message: 'Pipeline name is required' });
      return;
    }
    if (pipelineStages.some((s) => !s.name.trim())) {
      addNotification({ type: 'error', message: 'All stages must have a name' });
      return;
    }

    api
      .post('/approvals/pipelines', {
        name: pipelineName,
        description: pipelineDesc,
        stages: pipelineStages.map((s) => ({ name: s.name, requiredRole: s.requiredRole })),
      })
      .then(() => {
        addNotification({ type: 'success', message: 'Pipeline created' });
        setShowCreatePipeline(false);
        setPipelineName('');
        setPipelineDesc('');
        setPipelineStages([{ id: '1', name: 'Review', requiredRole: 'reviewer' }]);
        fetchData();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to create pipeline' });
      });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'badge-green';
      case 'rejected':
        return 'bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full';
      case 'pending':
        return 'badge-yellow';
      default:
        return 'badge-gray';
    }
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
            <CheckSquare className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Approvals</h1>
            <p className="text-sm text-slate-500">Manage approval workflows and requests</p>
          </div>
        </div>
        <button onClick={fetchData} className="btn-secondary btn-sm" disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'requests'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('pipelines')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'pipelines'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Pipelines ({pipelines.length})
        </button>
      </div>

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="card">
          {requests.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {requests.map((req) => {
                const expanded = expandedRequest === req.id;
                return (
                  <div key={req.id}>
                    <button
                      onClick={() => setExpandedRequest(expanded ? null : req.id)}
                      className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-900">{req.title}</span>
                          <span className={statusBadge(req.status)}>{req.status}</span>
                          <span className="badge-gray">{req.entityType}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          By {req.requestedBy} &middot;{' '}
                          {new Date(req.createdAt).toLocaleDateString()} &middot;{' '}
                          {req.entityName}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 flex-shrink-0">
                        Stage {req.currentStage + 1}/{req.stages.length}
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-6 pb-6 pl-14 space-y-4">
                        {req.description && (
                          <p className="text-sm text-slate-600">{req.description}</p>
                        )}

                        {/* Stage progress stepper */}
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-3 block">
                            Approval Stages
                          </label>
                          <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            {req.stages.map((stage, i) => (
                              <div key={i} className="flex items-center gap-2 flex-shrink-0">
                                <div
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                                    stage.status === 'approved'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                      : stage.status === 'rejected'
                                        ? 'bg-red-50 border-red-200 text-red-700'
                                        : stage.status === 'current'
                                          ? 'bg-brand-50 border-brand-200 text-brand-700'
                                          : 'bg-slate-50 border-slate-200 text-slate-500'
                                  }`}
                                >
                                  {stage.status === 'approved' ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : stage.status === 'rejected' ? (
                                    <X className="w-3.5 h-3.5" />
                                  ) : stage.status === 'current' ? (
                                    <Clock className="w-3.5 h-3.5" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                                  )}
                                  <span className="font-medium">{stage.name}</span>
                                </div>
                                {i < req.stages.length - 1 && (
                                  <div className="w-6 h-px bg-slate-300 flex-shrink-0" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Approve/Reject actions */}
                        {req.status === 'pending' && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-slate-400" />
                              <input
                                className="input py-1.5 text-sm flex-1"
                                placeholder="Add a comment (optional)..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApprove(req.id)}
                                className="btn-primary btn-sm"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(req.id)}
                                className="btn-secondary btn-sm text-red-600 hover:text-red-700"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No Approval Requests</h3>
              <p className="text-sm text-slate-500">
                Approval requests will appear here when changes require review.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pipelines Tab */}
      {activeTab === 'pipelines' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowCreatePipeline(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Pipeline
            </button>
          </div>
          <div className="space-y-4">
            {pipelines.length > 0 ? (
              pipelines.map((pipeline) => (
                <div key={pipeline.id} className="card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-brand-600" />
                        <h4 className="font-semibold text-slate-900">{pipeline.name}</h4>
                        <span className="badge-blue">{pipeline.stages.length} stages</span>
                      </div>
                      {pipeline.description && (
                        <p className="text-sm text-slate-500 mt-1">{pipeline.description}</p>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {pipeline.activeRequests} active request
                      {pipeline.activeRequests !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Stage visualization */}
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {pipeline.stages.map((stage, i) => (
                      <div key={stage.id} className="flex items-center gap-2 flex-shrink-0">
                        <div className="bg-slate-100 rounded-lg px-3 py-2 text-sm">
                          <div className="font-medium text-slate-700">{stage.name}</div>
                          <div className="text-xs text-slate-500">{stage.requiredRole}</div>
                        </div>
                        {i < pipeline.stages.length - 1 && (
                          <div className="w-6 h-px bg-slate-300 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="card px-6 py-16 text-center">
                <GitBranch className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 mb-1">No Pipelines</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Create an approval pipeline to define review stages.
                </p>
                <button onClick={() => setShowCreatePipeline(true)} className="btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" />
                  Create Pipeline
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Pipeline Modal */}
      <Modal
        open={showCreatePipeline}
        onClose={() => setShowCreatePipeline(false)}
        title="Create Approval Pipeline"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Pipeline Name</label>
            <input
              className="input"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              placeholder="e.g. Production Deployment Review"
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input min-h-[60px]"
              value={pipelineDesc}
              onChange={(e) => setPipelineDesc(e.target.value)}
              placeholder="Describe the purpose of this pipeline..."
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Stages</label>
              <button onClick={addPipelineStage} className="btn-secondary btn-sm">
                <Plus className="w-3.5 h-3.5" />
                Add Stage
              </button>
            </div>
            <div className="space-y-3">
              {pipelineStages.map((stage, i) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 bg-slate-50 rounded-lg p-3"
                >
                  <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <input
                    className="input py-1.5 text-sm flex-1"
                    value={stage.name}
                    onChange={(e) => updatePipelineStage(stage.id, 'name', e.target.value)}
                    placeholder="Stage name"
                  />
                  <select
                    className="input py-1.5 text-sm w-36"
                    value={stage.requiredRole}
                    onChange={(e) =>
                      updatePipelineStage(stage.id, 'requiredRole', e.target.value)
                    }
                  >
                    <option value="reviewer">Reviewer</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                  {pipelineStages.length > 1 && (
                    <button
                      onClick={() => removePipelineStage(stage.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreatePipeline(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreatePipeline} className="btn-primary">
              <CheckSquare className="w-4 h-4" />
              Create Pipeline
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
