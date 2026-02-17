import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import { Plus, Unplug, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const OAUTH_PLATFORMS: PlatformType[] = [
  'facebook', 'instagram', 'tiktok', 'linkedin', 'twitter', 'youtube', 'pinterest',
];

const MANUAL_PLATFORMS: PlatformType[] = [
  'bluesky', 'mastodon', 'telegram', 'entreprenrs', 'chrxstians', 'iohah',
];

const allPlatforms: PlatformType[] = [...OAUTH_PLATFORMS, ...MANUAL_PLATFORMS];

interface Connection {
  id: string;
  platform: string;
  accountName: string;
  accountId: string;
  isActive: boolean;
  tokenExpired: boolean;
  lastSyncAt: string | null;
}

export function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await api.connections.list();
      setConnections(res.data);
    } catch {
      // Not connected to API yet — show empty state
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  async function handleConnect(platform: PlatformType) {
    setLoading(platform);
    try {
      if (OAUTH_PLATFORMS.includes(platform)) {
        const res = await api.connections.initiateOAuth(platform);
        window.location.href = res.data.authUrl;
      }
      // Manual platforms would open a modal — simplified for now
    } catch (err) {
      console.error('Connect error:', err);
    } finally {
      setLoading(null);
    }
  }

  async function handleDisconnect(connectionId: string) {
    setLoading(connectionId);
    try {
      await api.connections.disconnect(connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setLoading(null);
    }
  }

  function getConnection(platform: PlatformType): Connection | undefined {
    return connections.find((c) => c.platform === platform);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Connections</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Connect your social media accounts ({connections.length} connected)
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchConnections}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allPlatforms.map((platformId) => {
          const platform = PLATFORMS[platformId];
          const connection = getConnection(platformId);
          const isConnected = !!connection;

          return (
            <Card key={platformId} hover className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${platform.color}15` }}
                  >
                    <div
                      className="w-5 h-5 rounded-full"
                      style={{ backgroundColor: platform.color }}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">{platform.name}</p>
                    <p className="text-xs text-neutral-400">
                      {isConnected ? connection.accountName : (
                        platform.supportsAds ? 'Post • Analytics • Ads' :
                        platform.supportsAnalytics ? 'Post • Analytics' : 'Post'
                      )}
                    </p>
                  </div>
                </div>
                {isConnected ? (
                  connection.tokenExpired ? (
                    <Badge variant="warning">
                      <AlertCircle className="w-3 h-3 mr-1" /> Expired
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                    </Badge>
                  )
                ) : (
                  <Badge variant="default">Not connected</Badge>
                )}
              </div>
              {isConnected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                  loading={loading === connection.id}
                  onClick={() => handleDisconnect(connection.id)}
                >
                  <Unplug className="w-4 h-4" /> Disconnect
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  loading={loading === platformId}
                  onClick={() => handleConnect(platformId)}
                >
                  <Plus className="w-4 h-4" /> Connect
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
