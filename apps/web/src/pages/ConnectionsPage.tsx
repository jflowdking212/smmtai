import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import {
  MANUAL_CONNECTION_PLATFORMS,
  OAUTH_PLATFORMS,
  GLOBAL_CREDENTIAL_PLATFORMS,
  TIER_PLATFORMS,
  PLATFORMS,
  isPlatformType,
  type PlatformType,
} from '@ee-postmind/shared';
import { Plus, Unplug, RefreshCw, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

const allPlatforms: PlatformType[] = [...OAUTH_PLATFORMS, ...MANUAL_CONNECTION_PLATFORMS];

interface ManualField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password';
  helpText?: string;
}

const MANUAL_FIELDS: Partial<Record<PlatformType, ManualField[]>> = {
  bluesky: [
    { key: 'identifier', label: 'Handle or email', placeholder: 'you.bsky.social' },
    { key: 'password', label: 'App password', type: 'password' },
  ],
  mastodon: [
    { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://mastodon.social' },
    { key: 'accessToken', label: 'Access token', type: 'password' },
  ],
  telegram: [
    { key: 'botToken', label: 'Bot token', type: 'password', helpText: 'Create one with @BotFather.' },
    { key: 'chatId', label: 'Default chat ID', placeholder: '@mychannel or -1001234567890', helpText: 'Required for publishing. Use a channel username or numeric chat ID.' },
  ],
  entreprenrs: [
    { key: 'accessToken', label: 'Access token', type: 'password' },
    { key: 'serverKey', label: 'Server key', type: 'password' },
  ],
  chrxstians: [{ key: 'accessToken', label: 'Access token', type: 'password' }],
  iohah: [{ key: 'accessToken', label: 'Access token', type: 'password' }],
};

interface Connection {
  id: string;
  platform: string;
  accountName: string;
  accountId: string;
  isActive: boolean;
  tokenExpired: boolean;
  lastSyncAt: string | null;
}

interface ConnectionHealthResult {
  id: string;
  platform: string;
  accountName: string;
  accountId: string;
  isActive: boolean;
  tokenExpired: boolean;
  lastSyncAt: string | null;
  healthy: boolean;
  error?: { code: string; message: string };
}

function buildCredentials(platform: PlatformType, values: Record<string, string>): string {
  switch (platform) {
    case 'bluesky':
      return JSON.stringify({ identifier: values.identifier?.trim(), password: values.password || '' });
    case 'mastodon':
      return JSON.stringify({
        instanceUrl: values.instanceUrl?.trim() || 'https://mastodon.social',
        accessToken: values.accessToken?.trim() || '',
      });
    case 'telegram':
      return JSON.stringify({
        botToken: values.botToken?.trim() || '',
        chatId: values.chatId?.trim() || '',
      });
    case 'entreprenrs':
      return JSON.stringify({
        accessToken: values.accessToken?.trim() || '',
        serverKey: values.serverKey?.trim() || '',
      });
    case 'chrxstians':
      return JSON.stringify({ accessToken: values.accessToken?.trim() || '' });
    case 'iohah':
      return JSON.stringify({ accessToken: values.accessToken?.trim() || '' });
    default:
      return '';
  }
}

function getInitialForm(platform: PlatformType): Record<string, string> {
  if (platform === 'mastodon') {
    return { instanceUrl: 'https://mastodon.social', accessToken: '' };
  }
  return {};
}

function formatCallbackError(error: string): string {
  switch (error) {
    case 'invalid_platform':
      return 'That platform is not supported for connection.';
    case 'invalid_connection_mode':
      return 'This platform must be connected using manual credentials.';
    case 'missing_params':
      return 'The authorization response was incomplete.';
    case 'invalid_state':
      return 'The authorization request has expired. Please try again.';
    case 'connection_failed':
      return 'Connection failed. Please retry or verify your credentials.';
    default:
      return 'Connection failed. Please try again.';
  }
}

export function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [manualPlatform, setManualPlatform] = useState<PlatformType | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [globalPlatforms, setGlobalPlatforms] = useState<Set<string>>(new Set());
  const { tier } = useSubscription();

  const allowedPlatforms = new Set<string>(TIER_PLATFORMS[tier] || TIER_PLATFORMS.basic);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await api.connections.list();
      setConnections(res.data);
    } catch {
      // Not connected to API yet — show empty state
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);
  useEffect(() => {
    api.connections.getGlobalPlatforms()
      .then((res) => setGlobalPlatforms(new Set(res.data)))
      .catch(() => { /* ignore */ });
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected && isPlatformType(connected)) {
      setMessage({ type: 'success', text: `${PLATFORMS[connected].name} connected successfully.` });
      fetchConnections();
    } else if (error) {
      setMessage({ type: 'error', text: formatCallbackError(error) });
    }

    if (connected || error) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchConnections]);

  async function handleConnect(platform: PlatformType) {
    setLoading(platform);
    setMessage(null);
    try {
      if (OAUTH_PLATFORMS.includes(platform)) {
        const res = await api.connections.initiateOAuth(platform);
        window.location.href = res.data.authUrl;
        return;
      }
      // If this platform has global credentials, connect directly without prompting
      if (globalPlatforms.has(platform)) {
        await api.connections.manualConnect(platform, '');
        await fetchConnections();
        setMessage({ type: 'success', text: `${PLATFORMS[platform].name} connected successfully.` });
        return;
      }
      if (MANUAL_CONNECTION_PLATFORMS.includes(platform)) {
        setManualPlatform(platform);
        setManualValues(getInitialForm(platform));
      }
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Unable to start connection flow';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(null);
    }
  }

  async function handleDisconnect(connectionId: string) {
    setLoading(connectionId);
    setMessage(null);
    try {
      await api.connections.disconnect(connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      setMessage({ type: 'success', text: 'Platform disconnected.' });
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Unable to disconnect platform';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(null);
    }
  }

  async function handleHealthCheck(connectionId: string) {
    const loadingKey = `health-${connectionId}`;
    setLoading(loadingKey);
    setMessage(null);

    try {
      const res = await api.connections.healthCheck(connectionId);
      const updated = res.data as ConnectionHealthResult;
      setConnections((prev) => prev.map((connection) => (
        connection.id === updated.id
          ? {
            id: updated.id,
            platform: updated.platform,
            accountName: updated.accountName,
            accountId: updated.accountId,
            isActive: updated.isActive,
            tokenExpired: updated.tokenExpired,
            lastSyncAt: updated.lastSyncAt,
          }
          : connection
      )));

      if (updated.healthy) {
        setMessage({ type: 'success', text: 'Connection is healthy.' });
      } else {
        setMessage({
          type: 'error',
          text: updated.error?.message || 'Connection needs attention. Reconnect the account.',
        });
      }
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Unable to check connection health';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(null);
    }
  }

  async function handleManualConnect() {
    if (!manualPlatform) return;
    const fields = MANUAL_FIELDS[manualPlatform] || [];
    const missingField = fields.find((field) => !manualValues[field.key]?.trim());
    if (missingField) {
      setMessage({ type: 'error', text: `${missingField.label} is required.` });
      return;
    }

    setLoading(manualPlatform);
    setMessage(null);

    try {
      const credentials = buildCredentials(manualPlatform, manualValues);
      await api.connections.manualConnect(manualPlatform, credentials);
      await fetchConnections();
      setManualPlatform(null);
      setManualValues({});
      setMessage({ type: 'success', text: `${PLATFORMS[manualPlatform].name} connected successfully.` });
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Could not connect platform';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(null);
    }
  }

  function getConnection(platform: PlatformType): Connection | undefined {
    return connections.find((c) => c.platform === platform);
  }

  const manualFields = manualPlatform ? MANUAL_FIELDS[manualPlatform] || [] : [];

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
      {message && (
        <Card className={`p-3 ${message.type === 'error' ? 'border-red-200 bg-red-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
          <p className={`text-sm ${message.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message.text}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allPlatforms.map((platformId) => {
          const platform = PLATFORMS[platformId];
          const connection = getConnection(platformId);
          const isConnected = !!connection;
          const needsReconnect = isConnected && (!connection.isActive || connection.tokenExpired);
          const isLocked = !allowedPlatforms.has(platformId);

          return (
            <Card key={platformId} hover className={`p-5 ${isLocked ? 'opacity-60' : ''}`}>
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
                  !connection.isActive || connection.tokenExpired ? (
                    <Badge variant="warning">
                      <AlertCircle className="w-3 h-3 mr-1" /> {connection.tokenExpired ? 'Expired' : 'Needs attention'}
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
                <div className="grid grid-cols-2 gap-2">
                  {needsReconnect ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      loading={loading === platformId}
                      disabled={loading === connection.id || loading === `health-${connection.id}`}
                      onClick={() => handleConnect(platformId)}
                    >
                      <RefreshCw className="w-4 h-4" /> Reconnect
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      loading={loading === `health-${connection.id}`}
                      disabled={loading === connection.id || loading === platformId}
                      onClick={() => handleHealthCheck(connection.id)}
                    >
                      <RefreshCw className="w-4 h-4" /> Check
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                    loading={loading === connection.id}
                    disabled={loading === `health-${connection.id}` || loading === platformId}
                    onClick={() => handleDisconnect(connection.id)}
                  >
                    <Unplug className="w-4 h-4" /> Disconnect
                  </Button>
                </div>
              ) : isLocked ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-neutral-400"
                  onClick={() => setMessage({ type: 'error', text: `Upgrade your plan to connect ${platform.name}.` })}
                >
                  <Lock className="w-4 h-4" /> Upgrade to Connect
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

      {manualPlatform && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setManualPlatform(null)}
        >
          <Card className="w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-heading font-semibold text-neutral-900">
                Connect {PLATFORMS[manualPlatform].name}
              </h2>
              <p className="text-sm text-neutral-500 mt-1">Enter your credentials to securely connect this account.</p>
            </div>

            <div className="space-y-3">
              {manualFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Input
                    label={field.label}
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={manualValues[field.key] || ''}
                    onChange={(e) => setManualValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                  {field.helpText && <p className="text-xs text-neutral-500">{field.helpText}</p>}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManualPlatform(null)}
                disabled={loading === manualPlatform}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                loading={loading === manualPlatform}
                onClick={handleManualConnect}
              >
                Connect account
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
