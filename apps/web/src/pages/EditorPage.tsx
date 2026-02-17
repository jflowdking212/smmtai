import { useState, useRef, useCallback } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { useCanvas, type CanvasSize } from '@/hooks/useCanvas';
import { CANVAS_SIZES, getCanvasSize, getAvailablePostTypes } from '@/lib/canvasSizes';
import { TEMPLATES, getCategories, getTemplatesByCategory, type TemplateData } from '@/lib/templates';
import {
  Type, Square, Circle, Minus, ImageIcon, Undo2, Redo2, Trash2,
  Download, Layers, ArrowUp, ArrowDown, Palette, LayoutTemplate,
  ChevronDown, X,
} from 'lucide-react';

const SCALE_FACTOR = 0.4; // Scale canvas for display

export function EditorPage() {
  const [platform, setPlatform] = useState('instagram');
  const [postType, setPostType] = useState('post');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState('');
  const [bgColor, setBgColor] = useState('#ffffff');

  const size = getCanvasSize(platform, postType);
  const {
    canvasReady, addText, addShape, addImage, deleteSelected,
    resizeCanvas, setBackground, exportImage, loadJSON,
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

  function handleExport(format: 'png' | 'jpeg') {
    const dataUrl = exportImage(format);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `postmind-${platform}-${postType}.${format}`;
    link.href = dataUrl;
    link.click();
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

  const displayW = size.width * SCALE_FACTOR;
  const displayH = size.height * SCALE_FACTOR;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Design Editor</h1>
          <p className="text-sm text-neutral-500 mt-1">{size.label} — {size.width}×{size.height}px</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowTemplates(!showTemplates)}>
            <LayoutTemplate className="w-4 h-4" /> Templates
          </Button>
          <Button size="sm" onClick={() => handleExport('png')}>
            <Download className="w-4 h-4" /> Export PNG
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
          <button onClick={() => fileInputRef.current?.click()} title="Upload Image" className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <ImageIcon className="w-5 h-5 text-neutral-600" />
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
        <Card className="p-4 w-56 space-y-4">
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
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Quick Add</label>
            <div className="space-y-1.5">
              <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Heading', { fontSize: 48, fontWeight: 'bold' } as any)}>
                + Heading
              </Button>
              <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Body text', { fontSize: 24 } as any)}>
                + Body Text
              </Button>
              <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Caption', { fontSize: 18, fill: '#6B7280' } as any)}>
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
    </div>
  );
}
