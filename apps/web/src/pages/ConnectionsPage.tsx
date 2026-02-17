import { Card, Button, Badge } from '@/components/ui';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import { Link2, Plus, ExternalLink } from 'lucide-react';

const allPlatforms: PlatformType[] = [
  'facebook', 'instagram', 'tiktok', 'linkedin', 'twitter',
  'youtube', 'pinterest', 'bluesky', 'mastodon', 'telegram',
  'entreprenrs', 'chrxstians', 'iohah',
];

export function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Connections</h1>
          <p className="text-sm text-neutral-500 mt-1">Connect your social media accounts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allPlatforms.map((platformId) => {
          const platform = PLATFORMS[platformId];
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
                      {platform.supportsAds ? 'Post • Analytics • Ads' :
                       platform.supportsAnalytics ? 'Post • Analytics' : 'Post'}
                    </p>
                  </div>
                </div>
                <Badge variant="default">Not connected</Badge>
              </div>
              <Button variant="secondary" size="sm" className="w-full">
                <Plus className="w-4 h-4" /> Connect
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
