import { Card } from '@/components/ui';
import { PenSquare } from 'lucide-react';

export function ComposePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-neutral-900">Compose Post</h1>
      <Card className="p-12 text-center">
        <PenSquare className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
        <p className="text-neutral-500">Post composer coming in Milestone 7</p>
      </Card>
    </div>
  );
}
