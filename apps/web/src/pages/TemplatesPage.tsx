import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge } from '@/components/ui';
import { TemplatePreview } from '@/components/TemplatePreview';
import { TEMPLATES, getCategories, getTemplatesByCategory } from '@/lib/templates';
import { Palette, Search, Grid3X3 } from 'lucide-react';

export function TemplatesPage() {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filtered = getTemplatesByCategory(category || undefined).filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Templates</h1>
          <p className="text-sm text-neutral-500 mt-1">{TEMPLATES.length} premade templates across {getCategories().length} categories</p>
        </div>
        <Button onClick={() => navigate('/editor')}>
          <Palette className="w-4 h-4" /> Open Editor
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategory('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
            ${!category ? 'bg-brand-blue text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
        >
          All ({TEMPLATES.length})
        </button>
        {getCategories().map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${category === cat ? 'bg-brand-blue text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filtered.map((t) => (
          <Card key={t.id} hover className="overflow-hidden cursor-pointer" onClick={() => navigate(`/editor?template=${encodeURIComponent(t.id)}`)}>
            <div className="relative aspect-square overflow-hidden">
              <TemplatePreview template={t} className="h-full w-full object-contain bg-neutral-50" alt={`${t.name} template preview`} />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <Badge variant="default" className="text-[10px]">
                  {t.width}×{t.height}
                </Badge>
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-neutral-800 truncate">{t.name}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{t.category}</p>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="p-12 text-center">
          <Grid3X3 className="w-10 h-10 mx-auto mb-3 text-neutral-200" />
          <p className="text-sm text-neutral-500">No templates match your search</p>
        </Card>
      )}
    </div>
  );
}
