import { useEffect, useState } from 'react';
import { Card, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { BookOpen, Plus, Trash2, Save, Search, X, Upload } from 'lucide-react';

interface KBEntry {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingEntry, setEditingEntry] = useState<Partial<KBEntry> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      const res = await api.chat.getKnowledge(Object.keys(params).length > 0 ? params : undefined);
      setEntries(res.data);
    } catch {
      setMsg({ type: 'error', text: 'Failed to load knowledge base.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [categoryFilter]);

  const categories = [...new Set(entries.map((e) => e.category).filter(Boolean))] as string[];

  const handleSave = async () => {
    if (!editingEntry?.title || !editingEntry?.content) {
      setMsg({ type: 'error', text: 'Title and content are required.' });
      return;
    }
    setSaving(true);
    try {
      if (editingEntry.id) {
        await api.chat.updateKnowledge(editingEntry.id, {
          title: editingEntry.title, content: editingEntry.content,
          category: editingEntry.category || undefined, tags: editingEntry.tags || [],
          priority: editingEntry.priority || 0,
        });
      } else {
        await api.chat.createKnowledge({
          title: editingEntry.title, content: editingEntry.content,
          category: editingEntry.category || undefined, tags: editingEntry.tags || [],
          priority: editingEntry.priority || 0,
        });
      }
      setMsg({ type: 'success', text: editingEntry.id ? 'Entry updated.' : 'Entry created.' });
      setEditingEntry(null);
      loadData();
    } catch {
      setMsg({ type: 'error', text: 'Failed to save entry.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this knowledge base entry?')) return;
    try {
      await api.chat.deleteKnowledge(id);
      setMsg({ type: 'success', text: 'Entry deleted.' });
      loadData();
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete entry.' });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { loadData(); return; }
    setLoading(true);
    try {
      const res = await api.chat.searchKnowledge(searchQuery);
      setEntries(res.data);
    } catch {
      setMsg({ type: 'error', text: 'Search failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const importEntries = Array.isArray(parsed) ? parsed : parsed.entries;
        if (!Array.isArray(importEntries)) { setMsg({ type: 'error', text: 'Invalid JSON format. Expected an array of entries.' }); return; }
        const res = await api.chat.bulkImportKnowledge(importEntries);
        setMsg({ type: 'success', text: `Imported ${res.data.imported}/${res.data.total} entries.` });
        loadData();
      } catch {
        setMsg({ type: 'error', text: 'Failed to import. Ensure valid JSON.' });
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Knowledge Base</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage AI chatbot knowledge for RAG-powered responses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleBulkImport}><Upload className="w-4 h-4" /> Import JSON</Button>
          <Button onClick={() => setEditingEntry({ title: '', content: '', category: '', tags: [], priority: 0 })}>
            <Plus className="w-4 h-4" /> Add Entry
          </Button>
        </div>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Semantic search..." className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
          <Button variant="secondary" size="sm" onClick={handleSearch}>Search</Button>
        </div>
        {categories.length > 0 && (
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Entry List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-neutral-500 py-8 text-center">Loading knowledge base...</p>
        ) : entries.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No knowledge base entries yet</p>
            <p className="text-xs text-neutral-400 mt-1">Add entries to help the AI chatbot answer questions accurately</p>
          </Card>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-neutral-900">{entry.title}</h3>
                    {entry.category && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{entry.category}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${entry.isActive ? 'bg-green-50 text-green-600' : 'bg-neutral-100 text-neutral-500'}`}>
                      {entry.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {entry.priority > 0 && <span className="text-xs text-neutral-400">Priority: {entry.priority}</span>}
                  </div>
                  <p className="text-xs text-neutral-600 line-clamp-2">{entry.content}</p>
                  {entry.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {entry.tags.map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded">{tag}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0 ml-4">
                  <Button variant="secondary" size="sm" onClick={() => setEditingEntry(entry)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Edit/Create Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingEntry(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">{editingEntry.id ? 'Edit Entry' : 'New Entry'}</h3>
              <button onClick={() => setEditingEntry(null)} className="p-1 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
                <input value={editingEntry.title || ''} onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" placeholder="Entry title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Content</label>
                <textarea value={editingEntry.content || ''} onChange={(e) => setEditingEntry({ ...editingEntry, content: e.target.value })}
                  rows={6} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" placeholder="Knowledge content..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
                  <input value={editingEntry.category || ''} onChange={(e) => setEditingEntry({ ...editingEntry, category: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" placeholder="e.g., features" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Priority (0-10)</label>
                  <input type="number" min={0} max={10} value={editingEntry.priority || 0}
                    onChange={(e) => setEditingEntry({ ...editingEntry, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Tags (comma-separated)</label>
                <input value={(editingEntry.tags || []).join(', ')}
                  onChange={(e) => setEditingEntry({ ...editingEntry, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" placeholder="tag1, tag2" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEditingEntry(null)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
