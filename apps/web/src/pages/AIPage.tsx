import { Card } from '@/components/ui';
import { Sparkles } from 'lucide-react';

export function AIPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-neutral-900">AI Assistant</h1>
      <Card className="p-12 text-center">
        <Sparkles className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
        <p className="text-neutral-500">AI content generation coming in Milestone 5</p>
      </Card>
    </div>
  );
}
