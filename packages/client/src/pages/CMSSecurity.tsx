import { useEffect, useState } from 'react';
import {
  Shield, FileText, Clock, User, Filter,
  Eye, Plus, Trash2, Database,
} from 'lucide-react';
import { getCMSAudit, getCMSMetadataSchemas, createCMSMetadataSchema, deleteCMSMetadataSchema } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { CMSMetadataSchema } from '../types';

const ACTION_COLORS: Record<string, string> = {
  create: 'text-green-600 bg-green-50',
  update: 'text-blue-600 bg-blue-50',
  delete: 'text-red-600 bg-red-50',
  view: 'text-slate-600 bg-slate-50',
  download: 'text-amber-600 bg-amber-50',
  share: 'text-violet-600 bg-violet-50',
  approve: 'text-emerald-600 bg-emerald-50',
  publish: 'text-indigo-600 bg-indigo-50',
  classify: 'text-teal-600 bg-teal-50',
  checkout: 'text-orange-600 bg-orange-50',
  checkin: 'text-cyan-600 bg-cyan-50',
};

interface AuditEntry {
  id: string;
  documentId: string | null;
  userId: string | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  entityName: string | null;
  details: Record<string, any>;
  ipAddress: string | null;
  createdAt: string;
}

export function CMSSecurity() {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [schemas, setSchemas] = useState<CMSMetadataSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'audit' | 'schemas'>('audit');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [showCreateSchema, setShowCreateSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');
  const [newSchemaDesc, setNewSchemaDesc] = useState('');
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (filterAction) params.action = filterAction;
    if (filterEntity) params.entity = filterEntity;
    Promise.all([getCMSAudit(params), getCMSMetadataSchemas()])
      .then(([a, s]) => { setAuditEntries(a); setSchemas(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterAction, filterEntity]);

  const handleCreateSchema = async () => {
    if (!newSchemaName.trim()) return;
    try {
      await createCMSMetadataSchema({ name: newSchemaName.trim(), description: newSchemaDesc });
      addNotification({ type: 'success', message: 'Schema created' });
      setShowCreateSchema(false);
      setNewSchemaName('');
      setNewSchemaDesc('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create schema' });
    }
  };

  const handleDeleteSchema = async (id: string, name: string) => {
    if (!confirm(`Delete metadata schema "${name}"?`)) return;
    try {
      await deleteCMSMetadataSchema(id);
      addNotification({ type: 'success', message: 'Schema deleted' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete schema' });
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
        <p className="text-sm text-slate-500">CMS audit trail, access logs, and metadata schema management.</p>
        {tab === 'schemas' && (
          <button onClick={() => setShowCreateSchema(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> New Schema
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('audit')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'audit' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Audit Trail
        </button>
        <button
          onClick={() => setTab('schemas')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'schemas' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Metadata Schemas ({schemas.length})
        </button>
      </div>

      {tab === 'audit' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input py-1.5 text-sm w-36">
              <option value="">All Actions</option>
              {Object.keys(ACTION_COLORS).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className="input py-1.5 text-sm w-36">
              <option value="">All Entities</option>
              {['document', 'folder', 'workflow', 'taxonomy', 'retention', 'rendition', 'comment'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {auditEntries.length > 0 ? (
            <div className="card divide-y divide-slate-100">
              {auditEntries.map((entry) => {
                const colors = ACTION_COLORS[entry.action] || 'text-slate-600 bg-slate-50';
                return (
                  <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors}`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm text-slate-900">
                          <span className="font-medium">{entry.userName || 'System'}</span>
                          <span className="mx-1 text-slate-400">{entry.action}</span>
                          <span className="text-slate-700">{entry.entity}</span>
                          {entry.entityName && <span className="text-slate-500 ml-1">"{entry.entityName}"</span>}
                        </div>
                        {entry.ipAddress && (
                          <div className="text-xs text-slate-400">IP: {entry.ipAddress}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-16 text-center">
              <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">No audit entries</h3>
              <p className="text-sm text-slate-500">Activity will appear here as users interact with documents.</p>
            </div>
          )}
        </>
      )}

      {tab === 'schemas' && (
        schemas.length > 0 ? (
          <div className="card divide-y divide-slate-100">
            {schemas.map((schema) => (
              <div key={schema.id} className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-indigo-600 bg-indigo-50">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{schema.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>v{schema.version}</span>
                      <span className="text-slate-300">|</span>
                      <span>{schema.fields.length} fields</span>
                      {schema.categories.length > 0 && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>{schema.categories.join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleDeleteSchema(schema.id, schema.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-16 text-center">
            <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 mb-1">No metadata schemas</h3>
            <p className="text-sm text-slate-500 mb-4">Create schemas to define structured metadata for documents.</p>
            <button onClick={() => setShowCreateSchema(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Create Schema
            </button>
          </div>
        )
      )}

      {/* Create Schema Modal */}
      <Modal open={showCreateSchema} onClose={() => setShowCreateSchema(false)} title="Create Metadata Schema">
        <div className="space-y-4">
          <div>
            <label className="label">Schema Name</label>
            <input className="input" placeholder="e.g., Invoice Metadata" value={newSchemaName} onChange={(e) => setNewSchemaName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={newSchemaDesc} onChange={(e) => setNewSchemaDesc(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreateSchema(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateSchema} className="btn-primary" disabled={!newSchemaName.trim()}>Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
