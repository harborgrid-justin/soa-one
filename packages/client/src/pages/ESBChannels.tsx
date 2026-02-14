import { useEffect, useState } from 'react';
import {
  Radio, Plus, Trash2, CheckCircle, XCircle, PauseCircle,
  MessageSquare, AlertTriangle, RefreshCw, Settings,
} from 'lucide-react';
import { getESBChannels, createESBChannel, updateESBChannel, deleteESBChannel } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { ESBChannel } from '../types';

const TYPE_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  'point-to-point': { label: 'Point-to-Point', desc: 'One producer, one consumer', color: 'text-blue-600 bg-blue-50' },
  'pub-sub': { label: 'Pub/Sub', desc: 'One-to-many broadcast', color: 'text-emerald-600 bg-emerald-50' },
  'dead-letter': { label: 'Dead Letter', desc: 'Failed message quarantine', color: 'text-red-600 bg-red-50' },
  'request-reply': { label: 'Request/Reply', desc: 'Synchronous pattern', color: 'text-violet-600 bg-violet-50' },
  'priority': { label: 'Priority', desc: 'Priority-ordered delivery', color: 'text-amber-600 bg-amber-50' },
};

export function ESBChannels() {
  const [channels, setChannels] = useState<ESBChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('point-to-point');
  const [editId, setEditId] = useState<string | null>(null);
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    getESBChannels()
      .then(setChannels)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createESBChannel({ name: newName.trim(), type: newType });
      addNotification({ type: 'success', message: 'Channel created' });
      setShowCreate(false);
      setNewName('');
      setNewType('point-to-point');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create channel' });
    }
  };

  const handleToggleStatus = async (channel: ESBChannel) => {
    const newStatus = channel.status === 'active' ? 'paused' : 'active';
    try {
      await updateESBChannel(channel.id, { status: newStatus });
      addNotification({ type: 'success', message: `Channel ${newStatus}` });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update channel' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete channel "${name}"? This cannot be undone.`)) return;
    try {
      await deleteESBChannel(id);
      addNotification({ type: 'success', message: 'Channel deleted' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete channel' });
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
        <p className="text-sm text-slate-500">Configure message channels for point-to-point, pub/sub, request-reply, and priority delivery.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Channel
        </button>
      </div>

      {channels.length > 0 ? (
        <div className="card divide-y divide-slate-100">
          {channels.map((channel) => {
            const meta = TYPE_LABELS[channel.type] || TYPE_LABELS['point-to-point'];
            return (
              <div key={channel.id} className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{channel.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium">{meta.label}</span>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />{channel.messageCount} msgs
                      </span>
                      {channel.errorCount > 0 && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="w-3 h-3" />{channel.errorCount} errors
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={
                    channel.status === 'active' ? 'badge-green' :
                    channel.status === 'paused' ? 'badge-yellow' :
                    channel.status === 'draining' ? 'badge-yellow' : 'badge-gray'
                  }>
                    {channel.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {channel.status === 'paused' && <PauseCircle className="w-3 h-3 mr-1" />}
                    {channel.status}
                  </span>
                  <button
                    onClick={() => handleToggleStatus(channel)}
                    className="btn-secondary btn-sm"
                    title={channel.status === 'active' ? 'Pause' : 'Resume'}
                  >
                    {channel.status === 'active' ? <PauseCircle className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {channel.status === 'active' ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => handleDelete(channel.id, channel.name)}
                    className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <Radio className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">No channels yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create a channel to start routing messages through the ESB.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Channel
          </button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Message Channel">
        <div className="space-y-4">
          <div>
            <label className="label">Channel Name</label>
            <input className="input" placeholder="e.g., order-events" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Channel Type</label>
            <div className="space-y-2">
              {Object.entries(TYPE_LABELS).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => setNewType(type)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    newType === type ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-900">{meta.label}</div>
                  <div className="text-xs text-slate-500">{meta.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
