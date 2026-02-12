import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, GitBranch, Database, MoreVertical, Trash2, Edit3 } from 'lucide-react';
import { getProjects, createProject, deleteProject } from '../api/client';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { useStore } from '../store';
import type { Project } from '../types';

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const { addNotification } = useStore();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getProjects()
      .then(setProjects)
      .catch(() => addNotification({ type: 'error', message: 'Failed to load projects' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const project = await createProject({ name: newName.trim(), description: newDesc.trim() });
      addNotification({ type: 'success', message: `Project "${project.name}" created` });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create project' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}" and all its rules? This cannot be undone.`)) return;
    try {
      await deleteProject(id);
      addNotification({ type: 'success', message: `Project "${name}" deleted` });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete project' });
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Organize your business rules by project</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-8 h-8" />}
          title="No projects yet"
          description="Create your first project to start building business rules."
          action={
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="card p-5 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-brand-600" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id, project.name);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{project.name}</h3>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">{project.description || 'No description'}</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <GitBranch className="w-3.5 h-3.5" />
                  {project._count?.ruleSets ?? 0} rule sets
                </div>
                <div className="flex items-center gap-1">
                  <Database className="w-3.5 h-3.5" />
                  {project._count?.dataModels ?? 0} models
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Project">
        <div className="space-y-4">
          <div>
            <label className="label">Project Name</label>
            <input
              className="input"
              placeholder="e.g., Insurance Underwriting"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="What business rules will this project contain?"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create Project</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
