import { Card } from '@/components/ui';
import { BarChart3 } from 'lucide-react';

export function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-neutral-900">Analytics</h1>
      <Card className="p-12 text-center">
        <BarChart3 className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
        <p className="text-neutral-500">Analytics dashboard coming in Milestone 9</p>
      </Card>
    </div>
  );
}
