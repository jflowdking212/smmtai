import { useState, useCallback } from 'react';
import { Button, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { MessageSquare, X, Send, Star } from 'lucide-react';

type FeedbackType = 'bug' | 'feature' | 'general';

const TYPES: { id: FeedbackType; label: string; emoji: string }[] = [
  { id: 'bug', label: 'Bug Report', emoji: '🐛' },
  { id: 'feature', label: 'Feature Request', emoji: '💡' },
  { id: 'general', label: 'General Feedback', emoji: '💬' },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await api.feedback.submit({ type, message: message.trim(), rating });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setMessage('');
        setRating(0);
        setType('general');
      }, 2000);
    } catch {
      // Silently fail — user can retry
    } finally {
      setSubmitting(false);
    }
  }, [message, type, rating]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-brand-blue text-white rounded-full p-3 shadow-lg hover:bg-brand-blue/90 transition-all hover:scale-105"
        title="Send feedback"
      >
        <MessageSquare className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80">
      <Card className="p-4 shadow-xl border-brand-blue/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-800">Send Feedback</h3>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-neutral-100">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm font-medium text-neutral-700">Thank you for your feedback!</p>
            <p className="text-xs text-neutral-500 mt-1">We'll review it shortly.</p>
          </div>
        ) : (
          <>
            {/* Feedback type */}
            <div className="flex gap-1.5 mb-3">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all
                    ${type === t.id ? 'bg-brand-blue text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-1 mb-3">
              <span className="text-xs text-neutral-500 mr-1">Rating:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="p-0.5">
                  <Star className={`w-4 h-4 ${n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300'}`} />
                </button>
              ))}
            </div>

            {/* Message */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind…"
              rows={3}
              className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none"
            />

            <Button
              size="sm"
              className="w-full mt-2"
              onClick={handleSubmit}
              disabled={!message.trim() || submitting}
            >
              {submitting ? 'Sending…' : <><Send className="w-3.5 h-3.5" /> Send Feedback</>}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
