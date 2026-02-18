import { useState, useRef, useCallback } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { useCanvas, type CanvasSize } from '@/hooks/useCanvas';
import { CANVAS_SIZES, getCanvasSize, getAvailablePostTypes } from '@/lib/canvasSizes';
import { TEMPLATES, getCategories, getTemplatesByCategory, type TemplateData } from '@/lib/templates';
import { api } from '@/lib/api';
import {
  Type, Square, Circle, Minus, MoveRight, ImageIcon, Undo2, Redo2, Trash2,
  Download, Layers, ArrowUp, ArrowDown, Palette, LayoutTemplate,
  ChevronDown, X, Search, Sparkles, Save, FileText, Users,
} from 'lucide-react';

const GOOGLE_FONTS = [
  'Inter', 'Poppins', 'Roboto', 'Montserrat', 'Open Sans', 'Lato',
  'Playfair Display', 'Raleway', 'Oswald', 'Merriweather', 'Nunito',
  'Source Sans 3', 'PT Sans', 'Ubuntu', 'Bebas Neue',
];

const GRADIENT_PRESETS = [
  { label: 'Blue → Purple', value: 'linear(#2563EB, #7C3AED)' },
  { label: 'Green → Teal', value: 'linear(#10B981, #06B6D4)' },
  { label: 'Orange → Red', value: 'linear(#F97316, #EF4444)' },
  { label: 'Pink → Purple', value: 'linear(#EC4899, #8B5CF6)' },
  { label: 'Cyan → Blue', value: 'linear(#06B6D4, #2563EB)' },
  { label: 'Yellow → Orange', value: 'linear(#EAB308, #F97316)' },
  { label: 'Slate → Zinc', value: 'linear(#334155, #18181B)' },
  { label: 'Rose → Amber', value: 'linear(#F43F5E, #F59E0B)' },
];

const PATTERN_PRESETS = [
  { label: 'Dots', value: '#f0f0f0' },
  { label: 'Light Grid', value: '#f5f5f5' },
];

interface CollabUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

const SCALE_FACTOR = 0.4; // Scale canvas for display

export function EditorPage() {
  const [platform, setPlatform] = useState('instagram');
  const [postType, setPostType] = useState('post');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState('');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [selectedFont, setSelectedFont] = useState('Inter');
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [imageQuery, setImageQuery] = useState('');
  const [imageResults, setImageResults] = useState<{ url: string; thumb: string; alt: string }[]>([]);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateCategory, setSaveTemplateCategory] = useState('Business & Corporate');
  const [savingTemplate, setSavingTemplate] = useState(false);
  // Collaborative editing presence (visual indicators)
  const [collabUsers] = useState<CollabUser[]>([
    // Populated via WebSocket/SSE in production — mock for UI
  ]);

  const size = getCanvasSize(platform, postType);
  const {
    canvasReady, addText, addShape, addImage, deleteSelected,
    resizeCanvas, setBackground, exportImage, loadJSON, toJSON,
    undo, redo, canUndo, canRedo, bringForward, sendBackward,
  } = useCanvas('editor-canvas', size);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePlatformChange(p: string) {
    setPlatform(p);
    const types = getAvailablePostTypes(p);
    const type = types.includes(postType) ? postType : types[0];
    setPostType(type);
    resizeCanvas(getCanvasSize(p, type));
  }

  function handlePostTypeChange(type: string) {
    setPostType(type);
    resizeCanvas(getCanvasSize(platform, type));
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleExport(format: 'png' | 'jpeg' | 'pdf') {
    if (format === 'pdf') {
      handleExportPDF();
      return;
    }
    const dataUrl = exportImage(format);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `postmind-${platform}-${postType}.${format}`;
    link.href = dataUrl;
    link.click();
  }

  async function handleExportPDF() {
    const dataUrl = exportImage('png');
    if (!dataUrl) return;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: size.width > size.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [size.width, size.height],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, size.width, size.height);
    pdf.save(`postmind-${platform}-${postType}.pdf`);
  }

  function handleLoadTemplate(template: TemplateData) {
    resizeCanvas({ width: template.width, height: template.height, label: template.name });
    loadJSON(template.json);
    setShowTemplates(false);
  }

  function handleBgChange(color: string) {
    setBgColor(color);
    setBackground(color);
  }

  async function handleImageSearch() {
    if (!imageQuery.trim()) return;
    setImageSearchLoading(true);
    try {
      // Unsplash API (requires UNSPLASH_ACCESS_KEY in env)
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(imageQuery)}&per_page=12`,
        { headers: { Authorization: `Client-ID ${(window as any).__UNSPLASH_KEY || 'demo'}` } },
      );
      const data = await res.json();
      setImageResults(
        (data.results || []).map((r: any) => ({
          url: r.urls.regular,
          thumb: r.urls.thumb,
          alt: r.alt_description || r.description || imageQuery,
        })),
      );
    } catch {
      setImageResults([]);
    } finally {
      setImageSearchLoading(false);
    }
  }

  async function handleAiImageGenerate() {
    if (!aiImagePrompt.trim()) return;
    setAiImageLoading(true);
    try {
      const res = await api.ai.imagePrompt({
        description: aiImagePrompt,
        platform,
        style: 'photorealistic',
      });
      if (res.data?.prompt) {
        // The AI service returns a prompt; in production this would call DALL-E
        // For now, show the generated prompt as text on canvas
        addText(res.data.prompt, { fontSize: 16, fill: '#6B7280', fontStyle: 'italic' } as any);
      }
    } catch {
      // Silently fail
    } finally {
      setAiImageLoading(false);
    }
  }

  async function handleSaveTemplate() {
    if (!saveTemplateName.trim()) return;
    setSavingTemplate(true);
    try {
      const json = toJSON();
      await api.templates.create({
        name: saveTemplateName,
        category: saveTemplateCategory,
        designData: json,
        platforms: [platform],
      });
      setShowSaveTemplate(false);
      setSaveTemplateName('');
    } catch {
      // Silently fail
    } finally {
      setSavingTemplate(false);
    }
  }

  const displayW = size.width * SCALE_FACTOR;
  const displayH = size.height * SCALE_FACTOR;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Design Editor</h1>
          <p className="text-sm text-neutral-500 mt-1">{size.label} — {size.width}×{size.height}px</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Collaborative presence indicators */}
          {collabUsers.length > 0 && (
            <div className="flex -space-x-2 mr-2">
              {collabUsers.map((u) => (
                <div
                  key={u.id}
                  title={`${u.name} is editing`}
                  className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: u.color }}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
              ))}
              <div className="flex items-center pl-3">
                <Users className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-xs text-neutral-400 ml-1">{collabUsers.length}</span>
              </div>
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(true)}>
            <Save className="w-4 h-4" /> Save Template
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowTemplates(!showTemplates)}>
            <LayoutTemplate className="w-4 h-4" /> Templates
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('jpeg')}>
            <Download className="w-4 h-4" /> JPG
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')}>
            <FileText className="w-4 h-4" /> PDF
          </Button>
          <Button size="sm" onClick={() => handleExport('png')}>
            <Download className="w-4 h-4" /> PNG
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Left toolbar */}
        <Card className="p-3 space-y-2 w-14 flex flex-col items-center">
          <button onClick={() => addText()} title="Add Text" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <Type className="w-5 h-5 text-neutral-600" />
          </button>
          <button onClick={() => addShape('rect')} title="Rectangle" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <Square className="w-5 h-5 text-neutral-600" />
          </button>
          <button onClick={() => addShape('circle')} title="Circle" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <Circle className="w-5 h-5 text-neutral-600" />
          </button>
          <button onClick={() => addShape('line')} title="Line" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <Minus className="w-5 h-5 text-neutral-600" />
          </button>
          <button onClick={() => addShape('arrow')} title="Arrow" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <MoveRight className="w-5 h-5 text-neutral-600" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="Upload Image" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <ImageIcon className="w-5 h-5 text-neutral-600" />
          </button>
          <button onClick={() => setShowImageSearch(!showImageSearch)} title="Search Images (Unsplash)" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <Search className="w-5 h-5 text-neutral-600" />
          </button>
          <button onClick={() => { const p = prompt('Describe the image to generate:'); if (p) { setAiImagePrompt(p); handleAiImageGenerate(); } }} title="AI Generate Image (DALL·E)" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <Sparkles className="w-5 h-5 text-neutral-600" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <div className="w-8 h-px bg-neutral-200" />
          <button onClick={undo} disabled={!canUndo} title="Undo" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-30">
            <Undo2 className="w-5 h-5 text-neutral-600" />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-30">
            <Redo2 className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="w-8 h-px bg-neutral-200" />
          <button onClick={bringForward} title="Bring Forward" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <ArrowUp className="w-5 h-5 text-neutral-600" />
          </button>
          <button onClick={sendBackward} title="Send Backward" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <ArrowDown className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="w-8 h-px bg-neutral-200" />
          <button onClick={deleteSelected} title="Delete" className="p-2 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 className="w-5 h-5 text-red-500" />
          </button>
        </Card>

        {/* Canvas */}
        <div className="flex-1 flex justify-center">
          <div
            className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden"
            style={{ width: displayW, height: displayH }}
          >
            <div style={{ transform: `scale(${SCALE_FACTOR})`, transformOrigin: 'top left' }}>
              <canvas id="editor-canvas" />
            </div>
          </div>
        </div>

        {/* Right panel — platform/size selector */}
        <Card className="p-4 w-56 space-y-4 overflow-y-auto max-h-[80vh]">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Platform</label>
            <select
              value={platform}
              onChange={(e) => handlePlatformChange(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm"
            >
              {Object.keys(CANVAS_SIZES).map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Post Type</label>
            <div className="flex flex-wrap gap-1.5">
              {getAvailablePostTypes(platform).map((type) => (
                <button
                  key={type}
                  onClick={() => handlePostTypeChange(type)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all
                    ${postType === type ? 'bg-brand-blue text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Font Family</label>
            <select
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm"
            >
              {GOOGLE_FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Background</label>
            <div className="flex gap-1.5 flex-wrap">
              {['#ffffff', '#f9fafb', '#111827', '#1e3a5f', '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((c) => (
                <button
                  key={c}
                  onClick={() => handleBgChange(c)}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${bgColor === c ? 'border-brand-blue scale-110' : 'border-neutral-200'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Gradients</label>
            <div className="flex gap-1.5 flex-wrap">
              {GRADIENT_PRESETS.map((g) => {
                const colors = g.value.match(/#[0-9A-Fa-f]{6}/g) || [];
                return (
                  <button
                    key={g.label}
                    onClick={() => handleBgChange(g.value)}
                    title={g.label}
                    className="w-7 h-7 rounded-lg border-2 border-neutral-200 transition-all hover:scale-110"
                    style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Quick Add</label>
            <div className="space-y-1.5">
              <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Heading', { fontSize: 48, fontWeight: 'bold', fontFamily: selectedFont } as any)}>
                + Heading
              </Button>
              <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Body text', { fontSize: 24, fontFamily: selectedFont } as any)}>
                + Body Text
              </Button>
              <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Caption', { fontSize: 18, fill: '#6B7280', fontFamily: selectedFont } as any)}>
                + Caption
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Template browser modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h2 className="text-lg font-heading font-bold text-neutral-900">Templates ({TEMPLATES.length})</h2>
              <button onClick={() => setShowTemplates(false)} className="p-1 rounded hover:bg-neutral-100">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="flex gap-2 p-4 pb-0 flex-wrap">
              <button
                onClick={() => setTemplateCategory('')}
                className={`px-3 py-1 rounded-full text-xs font-medium ${!templateCategory ? 'bg-brand-blue text-white' : 'bg-neutral-100 text-neutral-600'}`}
              >
                All
              </button>
              {getCategories().map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTemplateCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${templateCategory === cat ? 'bg-brand-blue text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {getTemplatesByCategory(templateCategory || undefined).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleLoadTemplate(t)}
                    className="group text-left rounded-lg overflow-hidden border border-neutral-200 hover:border-brand-blue hover:shadow-md transition-all"
                  >
                    <div
                      className="aspect-square flex items-end p-2"
                      style={{ backgroundColor: t.thumbnail }}
                    >
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/30 text-white backdrop-blur-sm">
                        {t.width}×{t.height}
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-neutral-800 truncate">{t.name}</p>
                      <p className="text-[10px] text-neutral-400">{t.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Image search panel (Unsplash/Pexels) */}
      {showImageSearch && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h2 className="text-lg font-heading font-bold text-neutral-900">Search Images</h2>
              <button onClick={() => setShowImageSearch(false)} className="p-1 rounded hover:bg-neutral-100">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="p-4 flex gap-2">
              <input
                value={imageQuery}
                onChange={(e) => setImageQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImageSearch()}
                placeholder="Search Unsplash photos..."
                className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
              <Button size="sm" onClick={handleImageSearch} disabled={imageSearchLoading}>
                {imageSearchLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-0">
              <div className="grid grid-cols-3 gap-2">
                {imageResults.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => { addImage(img.url); setShowImageSearch(false); }}
                    className="rounded-lg overflow-hidden border border-neutral-200 hover:border-brand-blue hover:shadow-md transition-all"
                  >
                    <img src={img.thumb} alt={img.alt} className="w-full h-32 object-cover" />
                  </button>
                ))}
              </div>
              {imageResults.length === 0 && !imageSearchLoading && (
                <p className="text-center text-sm text-neutral-400 py-8">Search for stock photos to add to your design</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Save as custom template modal */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-heading font-bold text-neutral-900">Save as Template</h2>
              <button onClick={() => setShowSaveTemplate(false)} className="p-1 rounded hover:bg-neutral-100">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Template Name</label>
              <input
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="My Custom Template"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
              <select
                value={saveTemplateCategory}
                onChange={(e) => setSaveTemplateCategory(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
              >
                {getCategories().map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate} disabled={savingTemplate || !saveTemplateName.trim()}>
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
