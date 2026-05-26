import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ChevronDown, Check, Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';

export function WorkspaceSwitcher() {
  const { workspaceId, setAuth, user } = useAuthStore();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    function loadWorkspaces() {
      setLoading(true);
      api.workspaces.list()
        .then(res => setWorkspaces(res.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    loadWorkspaces();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSwitch(targetWorkspaceId: string) {
    if (targetWorkspaceId === workspaceId) {
      setIsOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await api.auth.switchWorkspace(targetWorkspaceId);
      if (res.success && res.data && user) {
        setAuth(
          user,
          res.data.accessToken,
          res.data.workspaceId,
          res.data.role,
          res.data.tier
        );
        setIsOpen(false);
        toast.success('Workspace Changed', 'You are now viewing the selected workspace.');
        // Optional: reload the page to ensure all contexts (dashboard, posts) are fresh
        window.location.reload();
      }
    } catch (err) {
      toast.error('Switch Failed', err instanceof Error ? err.message : 'Could not switch workspace');
    } finally {
      setSwitching(false);
    }
  }

  const activeWorkspace = workspaces.find(w => w.id === workspaceId);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching || loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition-colors border border-transparent hover:border-neutral-200"
      >
        <div className="w-6 h-6 rounded-md bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-xs">
          {activeWorkspace?.name?.charAt(0)?.toUpperCase() || 'W'}
        </div>
        <span className="text-sm font-medium text-neutral-700 max-w-[120px] truncate hidden md:block">
          {activeWorkspace?.name || 'Loading...'}
        </span>
        {switching ? (
          <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 z-50">
          <div className="px-3 pb-2 mb-2 border-b border-neutral-100">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Switch Workspace</p>
          </div>
          
          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              </div>
            ) : workspaces.length === 0 ? (
              <div className="px-4 py-2 text-sm text-neutral-500 text-center">
                No workspaces found
              </div>
            ) : (
              workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => handleSwitch(ws.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 transition-colors text-left ${ws.id === workspaceId ? 'bg-brand-blue/5' : ''}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-brand-blue/20 to-purple-100 flex items-center justify-center text-sm font-bold text-brand-blue">
                      {ws.name?.charAt(0)?.toUpperCase() || 'W'}
                    </div>
                    <div className="truncate">
                      <p className={`text-sm font-medium truncate ${ws.id === workspaceId ? 'text-brand-blue' : 'text-neutral-900'}`}>
                        {ws.name}
                      </p>
                      <p className="text-xs text-neutral-500 capitalize">{ws.role} • {ws._count?.members || 0} members</p>
                    </div>
                  </div>
                  {ws.id === workspaceId && <Check className="w-4 h-4 shrink-0 text-brand-blue ml-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
