import { useEffect, useState, DragEvent } from 'react';
import {
  FileText, Plus, Trash2, FolderOpen, Eye, Lock,
  CheckCircle, Clock, Filter, Pencil, Save, Upload, X,
} from 'lucide-react';
import { getCMSDocuments, createCMSDocument, updateCMSDocument, deleteCMSDocument, getCMSFolders, createCMSFolder } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { CMSDocument, CMSFolder, CMSDocumentCategory, CMSDocumentStatus } from '../types';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  document: { label: 'Document', color: 'text-blue-600 bg-blue-50' },
  spreadsheet: { label: 'Spreadsheet', color: 'text-emerald-600 bg-emerald-50' },
  presentation: { label: 'Presentation', color: 'text-amber-600 bg-amber-50' },
  image: { label: 'Image', color: 'text-pink-600 bg-pink-50' },
  video: { label: 'Video', color: 'text-purple-600 bg-purple-50' },
  report: { label: 'Report', color: 'text-indigo-600 bg-indigo-50' },
  contract: { label: 'Contract', color: 'text-red-600 bg-red-50' },
  invoice: { label: 'Invoice', color: 'text-orange-600 bg-orange-50' },
  policy: { label: 'Policy', color: 'text-teal-600 bg-teal-50' },
  template: { label: 'Template', color: 'text-violet-600 bg-violet-50' },
  email: { label: 'Email', color: 'text-slate-600 bg-slate-50' },
  form: { label: 'Form', color: 'text-cyan-600 bg-cyan-50' },
  audio: { label: 'Audio', color: 'text-fuchsia-600 bg-fuchsia-50' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'badge-gray' },
  'pending-review': { label: 'Pending Review', color: 'badge-yellow' },
  'in-review': { label: 'In Review', color: 'badge-yellow' },
  approved: { label: 'Approved', color: 'badge-green' },
  published: { label: 'Published', color: 'badge-green' },
  archived: { label: 'Archived', color: 'badge-gray' },
  suspended: { label: 'Suspended', color: 'badge-red' },
};

const SECURITY_LEVELS = ['public', 'internal', 'confidential', 'restricted', 'top-secret'];

export function CMSDocuments() {
  const [documents, setDocuments] = useState<CMSDocument[]>([]);
  const [folders, setFolders] = useState<CMSFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<CMSDocumentCategory>('document');
  const [newFolderId, setNewFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [detailDoc, setDetailDoc] = useState<CMSDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<CMSDocument | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<CMSDocumentCategory>('document');
  const [editTags, setEditTags] = useState('');
  const [editSecurity, setEditSecurity] = useState('internal');
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (filterCategory) params.category = filterCategory;
    if (filterStatus) params.status = filterStatus;
    Promise.all([getCMSDocuments(params), getCMSFolders()])
      .then(([docs, flds]) => { setDocuments(docs); setFolders(flds); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterCategory, filterStatus]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const data: any = { name: newName.trim(), description: newDescription, category: newCategory };
      if (newFolderId) data.folderId = newFolderId;
      await createCMSDocument(data);
      addNotification({ type: 'success', message: 'Document created' });
      setShowCreate(false);
      setNewName(''); setNewDescription(''); setNewCategory('document'); setNewFolderId('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create document' });
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createCMSFolder({ name: newFolderName.trim() });
      addNotification({ type: 'success', message: 'Folder created' });
      setShowCreateFolder(false);
      setNewFolderName('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create folder' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete document "${name}"? This cannot be undone.`)) return;
    try {
      await deleteCMSDocument(id);
      addNotification({ type: 'success', message: 'Document deleted' });
      if (detailDoc?.id === id) setDetailDoc(null);
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete document' });
    }
  };

  const handleStatusChange = async (doc: CMSDocument, newStatus: CMSDocumentStatus) => {
    try {
      await updateCMSDocument(doc.id, { status: newStatus });
      addNotification({ type: 'success', message: `Document ${newStatus}` });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update status' });
    }
  };

  const openEdit = (doc: CMSDocument) => {
    setEditingDoc(doc);
    setEditName(doc.name);
    setEditDescription(doc.description || '');
    setEditCategory(doc.category);
    setEditTags((doc.tags || []).join(', '));
    setEditSecurity(doc.securityLevel || 'internal');
  };

  const handleSaveEdit = async () => {
    if (!editingDoc || !editName.trim()) return;
    try {
      await updateCMSDocument(editingDoc.id, {
        name: editName.trim(),
        description: editDescription,
        category: editCategory,
        tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
        securityLevel: editSecurity,
      });
      addNotification({ type: 'success', message: 'Document updated' });
      setEditingDoc(null);
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update document' });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, docId: string) => {
    e.dataTransfer.setData('text/plain', docId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault();
    setDragOverFolder(null);
    const docId = e.dataTransfer.getData('text/plain');
    if (!docId) return;
    try {
      await updateCMSDocument(docId, { folderId });
      addNotification({ type: 'success', message: 'Document moved to folder' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to move document' });
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
        <p className="text-sm text-slate-500">Manage documents, folders, and content. Drag documents onto folders to organize.</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreateFolder(true)} className="btn-secondary btn-sm">
            <FolderOpen className="w-3.5 h-3.5" /> New Folder
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> New Document
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input py-1.5 text-sm w-40">
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input py-1.5 text-sm w-40">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Folders — drop targets */}
      {folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className={`card p-4 hover:shadow-md transition-all cursor-pointer ${dragOverFolder === folder.id ? 'ring-2 ring-brand-500 bg-brand-50 scale-105' : ''}`}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
            >
              <FolderOpen className={`w-8 h-8 mb-2 ${dragOverFolder === folder.id ? 'text-brand-500' : 'text-amber-500'}`} />
              <div className="text-sm font-medium text-slate-900 truncate">{folder.name}</div>
              <div className="text-xs text-slate-400">{folder._count?.documents ?? 0} docs</div>
            </div>
          ))}
        </div>
      )}

      {/* Documents List — draggable */}
      {documents.length > 0 ? (
        <div className="card divide-y divide-slate-100">
          {documents.map((doc) => {
            const catMeta = CATEGORY_LABELS[doc.category] || CATEGORY_LABELS.document;
            const statusMeta = STATUS_LABELS[doc.status] || STATUS_LABELS.draft;
            return (
              <div
                key={doc.id}
                className="px-6 py-4 flex items-center justify-between group cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={(e) => handleDragStart(e, doc.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${catMeta.color}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{doc.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium">{catMeta.label}</span>
                      <span className="text-slate-300">|</span>
                      <span>v{doc.version}</span>
                      <span className="text-slate-300">|</span>
                      <span>{formatBytes(doc.sizeBytes)}</span>
                      {doc.legalHold && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="text-red-500 flex items-center gap-1"><Lock className="w-3 h-3" />Legal Hold</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={statusMeta.color}>{statusMeta.label}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                  {doc.status === 'draft' && (
                    <button onClick={() => handleStatusChange(doc, 'pending-review')} className="btn-secondary btn-sm">Submit Review</button>
                  )}
                  {doc.status === 'in-review' && (
                    <button onClick={() => handleStatusChange(doc, 'approved')} className="btn-secondary btn-sm">
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                  <button onClick={() => openEdit(doc)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDetailDoc(doc)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(doc.id, doc.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">No documents yet</h3>
          <p className="text-sm text-slate-500 mb-4">Upload or create a document to get started.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Document</button>
        </div>
      )}

      {/* Create Document Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Document">
        <div className="space-y-4">
          <div>
            <label className="label">Document Name</label>
            <input className="input" placeholder="e.g., Q4 Report" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="Optional description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={newCategory} onChange={(e) => setNewCategory(e.target.value as CMSDocumentCategory)}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          {folders.length > 0 && (
            <div>
              <label className="label">Folder (optional)</label>
              <select className="input" value={newFolderId} onChange={(e) => setNewFolderId(e.target.value)}>
                <option value="">No folder (root)</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Create Folder Modal */}
      <Modal open={showCreateFolder} onClose={() => setShowCreateFolder(false)} title="Create Folder">
        <div className="space-y-4">
          <div>
            <label className="label">Folder Name</label>
            <input className="input" placeholder="e.g., Legal Documents" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} autoFocus />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreateFolder(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateFolder} className="btn-primary" disabled={!newFolderName.trim()}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Edit Document Modal */}
      <Modal open={!!editingDoc} onClose={() => setEditingDoc(null)} title="Edit Document">
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={editCategory} onChange={(e) => setEditCategory(e.target.value as CMSDocumentCategory)}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tags (comma-separated)</label>
            <input className="input" placeholder="e.g., legal, important, review" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
          </div>
          <div>
            <label className="label">Security Level</label>
            <select className="input" value={editSecurity} onChange={(e) => setEditSecurity(e.target.value)}>
              {SECURITY_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl.charAt(0).toUpperCase() + lvl.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditingDoc(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}>
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailDoc} onClose={() => setDetailDoc(null)} title={detailDoc?.name || ''}>
        {detailDoc && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              <button onClick={() => { openEdit(detailDoc); setDetailDoc(null); }} className="btn-primary btn-sm">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">Category:</span> <span className="font-medium capitalize">{detailDoc.category}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className="font-medium capitalize">{detailDoc.status}</span></div>
              <div><span className="text-slate-500">Version:</span> <span className="font-medium">{detailDoc.version}</span></div>
              <div><span className="text-slate-500">Size:</span> <span className="font-medium">{formatBytes(detailDoc.sizeBytes)}</span></div>
              <div><span className="text-slate-500">MIME Type:</span> <span className="font-medium">{detailDoc.mimeType}</span></div>
              <div><span className="text-slate-500">Security:</span> <span className="font-medium capitalize">{detailDoc.securityLevel}</span></div>
              <div><span className="text-slate-500">Created By:</span> <span className="font-medium">{detailDoc.createdBy}</span></div>
              <div><span className="text-slate-500">Legal Hold:</span> <span className="font-medium">{detailDoc.legalHold ? 'Yes' : 'No'}</span></div>
            </div>
            {detailDoc.description && (
              <div><span className="text-sm text-slate-500">Description:</span><p className="text-sm mt-1">{detailDoc.description}</p></div>
            )}
            {detailDoc.tags && detailDoc.tags.length > 0 && (
              <div>
                <span className="text-sm text-slate-500">Tags:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detailDoc.tags.map((tag, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
