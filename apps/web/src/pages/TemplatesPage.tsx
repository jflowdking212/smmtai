import { Card } from '@/components/ui';
import { Palette } from 'lucide-react';

export function TemplatesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-neutral-900">Templates</h1>
      <Card className="p-12 text-center">
        <Palette className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
        <p className="text-neutral-500">Template browser coming in Milestone 6</p>
      </Card>
    </div>
  );
}
