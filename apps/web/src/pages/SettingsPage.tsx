import { Card } from '@/components/ui';
import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-neutral-900">Settings</h1>
      <Card className="p-12 text-center">
        <Settings className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
        <p className="text-neutral-500">Settings coming in Milestone 2</p>
      </Card>
    </div>
  );
}
