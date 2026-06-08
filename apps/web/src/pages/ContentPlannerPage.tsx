import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, CalendarDays, Upload, Image as ImageIcon, Send, RefreshCw, Trash2, Edit, Palette } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

export function ContentPlannerPage() {
  const [activeTab, setActiveTab] = useState('new');
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            AI Content Planner
          </h1>
          <p className="text-muted-foreground mt-2">Generate a complete multi-platform social media plan in seconds.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="new">New Plan</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new">
          <NewPlanWizard />
        </TabsContent>
        
        <TabsContent value="history">
          <PlanHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewPlanWizard() {
  const [step, setStep] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['Instagram']);
  const [planId, setPlanId] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/v1/content-planner/generate', { prompt, platforms });
      return res.data;
    },
    onSuccess: (data) => {
      setPlanId(data.planId);
      setStep(3); // Go to review
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Generation failed');
    }
  });

  if (step === 3 && planId) {
    return <PlanReviewDashboard planId={planId} />;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-2 border-violet-100 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-violet-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-500" />
            {step === 1 ? 'Describe Your Goal' : 'Configuration'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">What do you want to achieve with your upcoming social media posts?</p>
              <Textarea 
                placeholder="e.g. Promote our upcoming Spring Sale for 7 days. Focus on high-energy, FOMO content."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="min-h-[150px] resize-none text-base border-violet-100 focus-visible:ring-violet-500"
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">Target Platforms</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {['Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'TikTok'].map(platform => (
                    <label key={platform} className="flex items-center space-x-2 border p-3 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                      <Checkbox 
                        checked={platforms.includes(platform)}
                        onCheckedChange={(checked) => {
                          if (checked) setPlatforms([...platforms, platform]);
                          else setPlatforms(platforms.filter(p => p !== platform));
                        }}
                      />
                      <span>{platform}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="p-4 border border-dashed rounded-lg bg-slate-50 flex flex-col items-center justify-center min-h-[120px]">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm font-medium">Upload Media (Optional)</p>
                <p className="text-xs text-muted-foreground">Drag images or videos here</p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t bg-slate-50/50 pt-6">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
          )}
          <div className="flex-1" />
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!prompt.trim()} className="bg-violet-600 hover:bg-violet-700">
              Next Step
            </Button>
          ) : (
            <Button 
              onClick={() => generateMutation.mutate()} 
              disabled={generateMutation.isPending || platforms.length === 0}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {generateMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate Plan
            </Button>
          )}
        </CardFooter>
      </Card>
      
      {generateMutation.isPending && (
        <div className="mt-8 text-center animate-pulse">
          <p className="text-violet-600 font-medium">✨ AI is analyzing your intent and generating content...</p>
          <p className="text-sm text-muted-foreground mt-1">This takes about 10-20 seconds.</p>
        </div>
      )}
    </div>
  );
}

function PlanReviewDashboard({ planId }: { planId: string }) {
  const { data: plan, isLoading, refetch } = useQuery({
    queryKey: ['content-plan', planId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/content-planner/plan/${planId}`);
      return res.data;
    },
    refetchInterval: (data: any) => data?.status === 'generating' ? 2000 : false
  });

  const [showMediaDialog, setShowMediaDialog] = useState(false);

  // Show media check dialog when generation completes and no media is present
  React.useEffect(() => {
    if (plan?.status === 'ready') {
      const hasMedia = plan.posts?.some((p: any) => p.mediaUrls?.length > 0 || p.mediaSource);
      if (!hasMedia) {
        setShowMediaDialog(true);
      }
    }
  }, [plan?.status, plan?.posts]);

  const authorizeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/v1/content-planner/plan/${planId}/authorize`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Plan authorized and scheduled!');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to authorize plan');
    }
  });

  if (isLoading || plan?.status === 'generating') {
    return (
      <div className="py-20 text-center">
        <RefreshCw className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
        <h3 className="text-xl font-medium">Generating your content plan...</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Review Your Plan</h2>
          <p className="text-muted-foreground">We generated {plan.posts?.length} posts based on your goals.</p>
        </div>
        {plan.status !== 'authorized' && (
          <Button 
            size="lg" 
            className="bg-violet-600 hover:bg-violet-700 shadow-md"
            onClick={() => authorizeMutation.mutate()}
            disabled={authorizeMutation.isPending}
          >
            <Send className="w-4 h-4 mr-2" />
            Authorize & Schedule All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plan.posts?.map((post: any) => (
          <PostCard key={post.id} post={post} onUpdate={refetch} />
        ))}
      </div>

      <Dialog open={showMediaDialog} onOpenChange={setShowMediaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Media to Your Plan?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Social media posts perform better with images or videos. Do you want to add some now?
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowMediaDialog(false)}>Skip for now</Button>
            <Button variant="outline" className="gap-2" onClick={() => setShowMediaDialog(false)}>
              <Upload className="w-4 h-4" /> Upload Files
            </Button>
            <Button className="bg-violet-600 gap-2" onClick={() => setShowMediaDialog(false)}>
              <Palette className="w-4 h-4" /> Design in Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostCard({ post, onUpdate }: { post: any, onUpdate: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(post.contentBody);

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/v1/content-planner/post/${post.id}/regenerate`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Post regenerated');
      onUpdate();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/api/v1/content-planner/post/${post.id}`, { contentBody: content });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Post updated');
      setIsEditing(false);
      onUpdate();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/api/v1/content-planner/post/${post.id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Post removed');
      onUpdate();
    }
  });

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm capitalize">{post.platform}</span>
        </div>
        <div className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
          {new Date(post.scheduledAt).toLocaleDateString()}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-4 text-sm whitespace-pre-wrap">
        {isEditing ? (
          <Textarea 
            value={content} 
            onChange={e => setContent(e.target.value)}
            className="min-h-[150px] mb-4 text-sm"
          />
        ) : (
          <div>
            <p className="mb-4">{post.contentBody}</p>
            {post.hashtags?.length > 0 && (
              <p className="text-violet-600 font-medium">{post.hashtags.map((t: string) => `#${t}`).join(' ')}</p>
            )}
            {post.mediaSuggestion && (
              <div className="mt-4 p-3 bg-slate-50 rounded-md border border-slate-100 flex items-start gap-2">
                <ImageIcon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-600 italic">Suggestion: {post.mediaSuggestion}</p>
              </div>
            )}
            {post.mediaUrls?.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto">
                {post.mediaUrls.map((url: string, i: number) => (
                  <img key={i} src={url} alt="Media" className="h-16 w-16 object-cover rounded-md border" />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0 justify-between">
        {isEditing ? (
          <div className="flex gap-2 w-full">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 bg-violet-600" onClick={() => updateMutation.mutate()}>Save</Button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 flex-wrap">
              <Button size="icon" variant="ghost" title="Edit" onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 text-slate-500" />
              </Button>
              <Button size="icon" variant="ghost" title="Regenerate" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
                <RefreshCw className={`w-4 h-4 text-slate-500 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="icon" variant="ghost" title="Add Media" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*,video/*';
                input.multiple = true;
                input.onchange = async (e: any) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  const formData = new FormData();
                  for (let i = 0; i < files.length; i++) formData.append('media', files[i]);
                  toast.loading('Uploading...', { id: 'upload' });
                  try {
                    await api.post(`/api/v1/content-planner/post/${post.id}/upload-media`, formData, {
                      headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    toast.success('Uploaded successfully', { id: 'upload' });
                    onUpdate();
                  } catch (err) {
                    toast.error('Upload failed', { id: 'upload' });
                  }
                };
                input.click();
              }}>
                <Upload className="w-4 h-4 text-slate-500" />
              </Button>
              <Button size="icon" variant="ghost" title="Design in Editor" onClick={() => {
                // Navigate to Editor with content plan post context
                window.location.href = `/editor?contentPlanPostId=${post.id}&platform=${post.platform}`;
              }}>
                <Palette className="w-4 h-4 text-slate-500" />
              </Button>
            </div>
            <Button size="icon" variant="ghost" title="Delete" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
              if (confirm('Remove this post from the plan?')) deleteMutation.mutate();
            }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function PlanHistory() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['content-plans-history'],
    queryFn: async () => {
      // NOTE: We'll need a /api/v1/content-planner/plans endpoint to fetch history
      const res = await api.get('/api/v1/content-planner/plans');
      return res.data;
    }
  });

  if (isLoading) return <div className="p-8 text-center">Loading history...</div>;

  return (
    <div className="space-y-4">
      {plans?.map((plan: any) => (
        <Card key={plan.id}>
          <CardHeader>
            <CardTitle className="text-lg flex justify-between">
              <span>Theme: {plan.theme}</span>
              <span className="text-sm font-normal px-2 py-1 bg-slate-100 rounded-full">{plan.status}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Generated {new Date(plan.createdAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      ))}
      {(!plans || plans.length === 0) && (
        <div className="text-center p-12 bg-slate-50 rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground">No plans generated yet.</p>
        </div>
      )}
    </div>
  );
}
