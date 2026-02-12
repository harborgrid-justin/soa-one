import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, GitBranch, Database, Plug, Workflow,
} from 'lucide-react';
import { getProject, createRuleSet, createDataModel, createWorkflow, createAdapter } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { Project, RuleSet, DataModel } from '../types';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateRS, setShowCreateRS] = useState(false);
  const [showCreateDM, setShowCreateDM] = useState(false);
  const [showCreateWF, setShowCreateWF] = useState(false);
  const [rsName, setRsName] = useState('');
  const [rsDesc, setRsDesc] = useState('');
  const [dmName, setDmName] = useState('');
  const [wfName, setWfName] = useState('');
  const [wfDesc, setWfDesc] = useState('');
  const { addNotification } = useStore();
  const navigate = useNavigate();

  const load = () => {
    if (!id) return;
    getProject(id)
      .then(setProject)
      .catch(() => addNotification({ type: 'error', message: 'Failed to load project' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleCreateRuleSet = async () => {
    if (!rsName.trim() || !id) return;
    try {
      const rs = await createRuleSet({ projectId: id, name: rsName.trim(), description: rsDesc.trim() });
      addNotification({ type: 'success', message: `Rule set "${rs.name}" created` });
      setShowCreateRS(false);
      setRsName('');
      setRsDesc('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create rule set' });
    }
  };

  const handleCreateDataModel = async () => {
    if (!dmName.trim() || !id) return;
    try {
      const dm = await createDataModel({ projectId: id, name: dmName.trim() });
      addNotification({ type: 'success', message: `Data model "${dm.name}" created` });
      setShowCreateDM(false);
      setDmName('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create data model' });
    }
  };

  const handleCreateWorkflow = async () => {
    if (!wfName.trim() || !id) return;
    try {
      const wf = await createWorkflow({ projectId: id, name: wfName.trim(), description: wfDesc.trim() });
      addNotification({ type: 'success', message: `Workflow "${wf.name}" created` });
      setShowCreateWF(false);
      setWfName('');
      setWfDesc('');
      navigate(`/workflows/${wf.id}`);
    } catch {
      addNotification({ type: 'error', message: 'Failed to create workflow' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-16 text-slate-500">Project not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/projects" className="text-slate-500 hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Projects
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-medium">{project.name}</span>
      </div>

      {/* Project header */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-slate-900">{project.name}</h2>
        <p className="text-sm text-slate-500 mt-1">{project.description || 'No description'}</p>
      </div>

      {/* Rule Sets */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-600" />
            Rule Sets
          </h3>
          <button onClick={() => setShowCreateRS(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
            Add Rule Set
          </button>
        </div>
        {project.ruleSets && project.ruleSets.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {project.ruleSets.map((rs: RuleSet) => (
              <div
                key={rs.id}
                className="px-6 py-4 hover:bg-slate-50/50 cursor-pointer flex items-center justify-between"
                onClick={() => navigate(`/rule-sets/${rs.id}`)}
              >
                <div>
                  <div className="font-medium text-slate-900">{rs.name}</div>
                  <div className="text-sm text-slate-500">{rs.description || 'No description'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={rs.status === 'published' ? 'badge-green' : rs.status === 'archived' ? 'badge-gray' : 'badge-yellow'}>
                    {rs.status}
                  </span>
                  <span className="text-xs text-slate-400">v{rs.version}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No rule sets yet. Create one to get started.
          </div>
        )}
      </div>

      {/* Workflows */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Workflow className="w-5 h-5 text-orange-600" />
            Workflows
          </h3>
          <button onClick={() => setShowCreateWF(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
            Add Workflow
          </button>
        </div>
        {(project as any).workflows && (project as any).workflows.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {(project as any).workflows.map((wf: any) => (
              <div
                key={wf.id}
                className="px-6 py-4 hover:bg-slate-50/50 cursor-pointer flex items-center justify-between"
                onClick={() => navigate(`/workflows/${wf.id}`)}
              >
                <div>
                  <div className="font-medium text-slate-900">{wf.name}</div>
                  <div className="text-sm text-slate-500">{wf.description || 'No description'}</div>
                </div>
                <span className={wf.status === 'active' ? 'badge-green' : wf.status === 'archived' ? 'badge-gray' : 'badge-yellow'}>
                  {wf.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No workflows yet. Create a BPMN workflow to orchestrate rule sets and services.
          </div>
        )}
      </div>

      {/* Data Models */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Data Models
          </h3>
          <button onClick={() => setShowCreateDM(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
            Add Model
          </button>
        </div>
        {project.dataModels && project.dataModels.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {project.dataModels.map((dm: DataModel) => (
              <div
                key={dm.id}
                className="px-6 py-4 hover:bg-slate-50/50 cursor-pointer flex items-center justify-between"
                onClick={() => navigate(`/data-models/${dm.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-900">{dm.name}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(dm.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No data models yet. Data models define the structure of facts your rules evaluate.
          </div>
        )}
      </div>

      {/* Create Rule Set Modal */}
      <Modal open={showCreateRS} onClose={() => setShowCreateRS(false)} title="Create Rule Set">
        <div className="space-y-4">
          <div>
            <label className="label">Rule Set Name</label>
            <input className="input" placeholder="e.g., Premium Calculation Rules" value={rsName} onChange={(e) => setRsName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px]" placeholder="Describe the purpose of these rules" value={rsDesc} onChange={(e) => setRsDesc(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreateRS(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateRuleSet} className="btn-primary" disabled={!rsName.trim()}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Create Data Model Modal */}
      <Modal open={showCreateDM} onClose={() => setShowCreateDM(false)} title="Create Data Model">
        <div className="space-y-4">
          <div>
            <label className="label">Model Name</label>
            <input className="input" placeholder="e.g., PolicyApplication" value={dmName} onChange={(e) => setDmName(e.target.value)} autoFocus />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreateDM(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateDataModel} className="btn-primary" disabled={!dmName.trim()}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Create Workflow Modal */}
      <Modal open={showCreateWF} onClose={() => setShowCreateWF(false)} title="Create Workflow">
        <div className="space-y-4">
          <div>
            <label className="label">Workflow Name</label>
            <input className="input" placeholder="e.g., Claims Processing" value={wfName} onChange={(e) => setWfName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px]" placeholder="Describe the workflow process" value={wfDesc} onChange={(e) => setWfDesc(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreateWF(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateWorkflow} className="btn-primary" disabled={!wfName.trim()}>Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
