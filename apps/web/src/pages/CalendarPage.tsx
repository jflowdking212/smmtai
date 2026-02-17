import { Card } from '@/components/ui';
import { Calendar } from 'lucide-react';

export function CalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-neutral-900">Content Calendar</h1>
      <Card className="p-12 text-center">
        <Calendar className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
        <p className="text-neutral-500">Calendar & scheduling coming in Milestone 8</p>
      </Card>
    </div>
  );
}
