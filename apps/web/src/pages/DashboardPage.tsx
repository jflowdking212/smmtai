import { Card, Badge, Button } from '@/components/ui';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import {
  TrendingUp,
  Users,
  BarChart3,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Sparkles,
} from 'lucide-react';

const stats = [
  { label: 'Total Followers', value: '24.5K', change: '+12.3%', up: true, icon: Users },
  { label: 'Engagement Rate', value: '4.8%', change: '+0.6%', up: true, icon: TrendingUp },
  { label: 'Posts This Month', value: '47', change: '+8', up: true, icon: FileText },
  { label: 'Avg. Reach', value: '8.2K', change: '-2.1%', up: false, icon: BarChart3 },
];

const connectedPlatforms: PlatformType[] = [
  'facebook',
  'instagram',
  'twitter',
  'linkedin',
  'youtube',
];

export function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Welcome back! Here's your social media overview.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm">
            <Sparkles className="w-4 h-4" /> AI Suggest
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4" /> New Post
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-brand-600" />
              </div>
              <Badge variant={stat.up ? 'success' : 'danger'}>
                {stat.up ? (
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-1" />
                )}
                {stat.change}
              </Badge>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
              <p className="text-sm text-neutral-500 mt-0.5">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Connected Platforms */}
      <Card className="p-6">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 mb-4">
          Connected Platforms
        </h2>
        <div className="flex flex-wrap gap-3">
          {connectedPlatforms.map((platformId) => {
            const platform = PLATFORMS[platformId];
            return (
              <div
                key={platformId}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 bg-white hover:shadow-sm transition-all duration-200"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: platform.color }}
                />
                <span className="text-sm font-medium text-neutral-700">{platform.name}</span>
                <Badge variant="success">Connected</Badge>
              </div>
            );
          })}
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-neutral-300 text-neutral-500 hover:border-brand-500 hover:text-brand-600 transition-all duration-200">
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add Platform</span>
          </button>
        </div>
      </Card>

      {/* Recent Posts placeholder */}
      <Card className="p-6">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 mb-4">Recent Posts</h2>
        <div className="text-center py-12 text-neutral-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No posts yet. Create your first post to get started!</p>
          <Button size="sm" className="mt-4">
            <Plus className="w-4 h-4" /> Create Post
          </Button>
        </div>
      </Card>
    </div>
  );
}
