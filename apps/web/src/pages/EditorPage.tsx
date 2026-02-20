import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Badge } from '@/components/ui';
import { TemplatePreview } from '@/components/TemplatePreview';
import { useCanvas, type CanvasSize } from '@/hooks/useCanvas';
import { CANVAS_SIZES, getCanvasSize, getAvailablePostTypes } from '@/lib/canvasSizes';
import { TEMPLATES, getCategories, getTemplatesByCategory, type TemplateData } from '@/lib/templates';
import { saveComposeSeed } from '@/lib/composeSeed';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Type, Square, Circle, Minus, MoveRight, ImageIcon, Undo2, Redo2, Trash2,
  Download, Layers, ArrowUp, ArrowDown, Palette, LayoutTemplate,
  ChevronDown, X, Search, Sparkles, Save, FileText, Users,
  Copy, ClipboardPaste, Group, Ungroup, Eye, EyeOff, Lock, Unlock,
  SunMedium, Contrast, Droplets, Eraser, Frame, Smile, ChevronsUp, ChevronsDown,
  Monitor, Radio, Car, Smartphone, Coffee, Music, Camera, Heart, Star, Zap,
  Globe, MapPin, ShoppingBag, Briefcase, Megaphone, Pen, BookOpen, Cpu, Wifi,
  Scissors, RotateCcw, RotateCw, Link2, Send,
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

// SVG icon library for drag-onto-canvas
const ICON_LIBRARY = [
  { name: 'Monitor', icon: Monitor, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>' },
  { name: 'Radio', icon: Radio, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></svg>' },
  { name: 'Car', icon: Car, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>' },
  { name: 'Phone', icon: Smartphone, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>' },
  { name: 'Coffee', icon: Coffee, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1"/><path d="M6 2v2"/></svg>' },
  { name: 'Music', icon: Music, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
  { name: 'Camera', icon: Camera, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>' },
  { name: 'Heart', icon: Heart, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' },
  { name: 'Star', icon: Star, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { name: 'Zap', icon: Zap, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="#8B5CF6" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>' },
  { name: 'Globe', icon: Globe, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>' },
  { name: 'Location', icon: MapPin, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>' },
  { name: 'Shopping', icon: ShoppingBag, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' },
  { name: 'Briefcase', icon: Briefcase, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>' },
  { name: 'Megaphone', icon: Megaphone, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>' },
  { name: 'Pen', icon: Pen, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>' },
  { name: 'Book', icon: BookOpen, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
  { name: 'CPU', icon: Cpu, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>' },
  { name: 'Wifi', icon: Wifi, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>' },
];

// Decorative frame SVGs
const FRAME_LIBRARY = [
  { name: 'Simple Border', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="5" y="5" width="190" height="190" rx="8" fill="none" stroke="#111827" stroke-width="3"/></svg>' },
  { name: 'Double Border', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="5" y="5" width="190" height="190" rx="8" fill="none" stroke="#111827" stroke-width="2"/><rect x="12" y="12" width="176" height="176" rx="6" fill="none" stroke="#111827" stroke-width="1"/></svg>' },
  { name: 'Rounded Frame', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="5" y="5" width="190" height="190" rx="24" fill="none" stroke="#2563EB" stroke-width="3"/></svg>' },
  { name: 'Circle Frame', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="95" fill="none" stroke="#111827" stroke-width="3"/></svg>' },
  { name: 'Diamond Frame', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><polygon points="100,5 195,100 100,195 5,100" fill="none" stroke="#8B5CF6" stroke-width="3"/></svg>' },
  { name: 'Dotted Border', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="5" y="5" width="190" height="190" rx="8" fill="none" stroke="#6B7280" stroke-width="2" stroke-dasharray="6 4"/></svg>' },
  { name: 'Corner Brackets', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M5 40V10a5 5 0 015-5h30" fill="none" stroke="#111827" stroke-width="3"/><path d="M195 40V10a5 5 0 00-5-5h-30" fill="none" stroke="#111827" stroke-width="3"/><path d="M5 160v30a5 5 0 005 5h30" fill="none" stroke="#111827" stroke-width="3"/><path d="M195 160v30a5 5 0 01-5 5h-30" fill="none" stroke="#111827" stroke-width="3"/></svg>' },
  { name: 'Ornate Frame', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="10" y="10" width="180" height="180" rx="4" fill="none" stroke="#D4AF37" stroke-width="3"/><rect x="18" y="18" width="164" height="164" rx="2" fill="none" stroke="#D4AF37" stroke-width="1"/><circle cx="10" cy="10" r="4" fill="#D4AF37"/><circle cx="190" cy="10" r="4" fill="#D4AF37"/><circle cx="10" cy="190" r="4" fill="#D4AF37"/><circle cx="190" cy="190" r="4" fill="#D4AF37"/></svg>' },
  { name: 'Hexagon', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><polygon points="100,5 185,50 185,150 100,195 15,150 15,50" fill="none" stroke="#10B981" stroke-width="3"/></svg>' },
  { name: 'Wave Border', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="5" y="5" width="190" height="190" rx="12" fill="none" stroke="#EC4899" stroke-width="3"/><path d="M5 100 Q30 85 55 100 Q80 115 105 100 Q130 85 155 100 Q180 115 195 100" fill="none" stroke="#EC4899" stroke-width="1.5" opacity="0.4"/></svg>' },
];

interface CollabUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

const SCALE_FACTOR = 0.4;

export function EditorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTemplateId = searchParams.get('template');
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
  const [collabUsers, setCollabUsers] = useState<CollabUser[]>([]);
  const [collabStatus, setCollabStatus] = useState<'idle' | 'connecting' | 'connected' | 'blocked' | 'error'>('idle');
  const [collabEnabled, setCollabEnabled] = useState(false);

  // New state for advanced features
  const [showLayers, setShowLayers] = useState(false);
  const [showImageTuning, setShowImageTuning] = useState(false);
  const [showIconLibrary, setShowIconLibrary] = useState(false);
  const [showFrameLibrary, setShowFrameLibrary] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [activeObjType, setActiveObjType] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [layerRefresh, setLayerRefresh] = useState(0);
  const [bgRemovalLoading, setBgRemovalLoading] = useState(false);
  const [showCropTools, setShowCropTools] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [sendingToCompose, setSendingToCompose] = useState(false);

  const size = getCanvasSize(platform, postType);
  const {
    canvas, canvasReady, addText, addShape, addImage, deleteSelected,
    resizeCanvas, setBackground, exportImage, loadJSON, toJSON,
    undo, redo, canUndo, canRedo, bringForward, sendBackward,
    copySelected, pasteClipboard, groupSelected, ungroupSelected,
    applyImageFilter, clearImageFilters, getObjects, getActiveType,
    selectObject, bringToFront, sendToBack, toggleObjectVisibility,
    toggleObjectLock, addSvgString, cropActiveImageToAspect,
    resetActiveImageCrop, rotateSelected,
  } = useCanvas('editor-canvas', size);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedQueryTemplateIdRef = useRef<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const collabClientIdRef = useRef(`client-${Math.random().toString(36).slice(2, 10)}`);
  const generatedRoomIdRef = useRef(`design-${Math.random().toString(36).slice(2, 10)}`);
  const applyingRemoteUpdateRef = useRef(false);
  const publishTimerRef = useRef<number | null>(null);
  const currentUser = useAuthStore((state) => state.user);
  const roomId = searchParams.get('room') || generatedRoomIdRef.current;

  // Track selection changes to show contextual panels
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onSelection = () => {
      setActiveObjType(getActiveType());
      setLayerRefresh((n) => n + 1);
      // Reset filter sliders when selecting a new image
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
    };
    c.on('selection:created', onSelection);
    c.on('selection:updated', onSelection);
    c.on('selection:cleared', () => {
      setActiveObjType(null);
      setShowImageTuning(false);
    });
    c.on('object:modified', () => setLayerRefresh((n) => n + 1));
    c.on('object:added', () => setLayerRefresh((n) => n + 1));
    c.on('object:removed', () => setLayerRefresh((n) => n + 1));
    return () => {
      c.off('selection:created', onSelection);
      c.off('selection:updated', onSelection);
      c.off('selection:cleared');
      c.off('object:modified');
      c.off('object:added');
      c.off('object:removed');
    };
  }, [canvas, canvasReady, getActiveType]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key === 'c') {
        e.preventDefault();
        copySelected();
      } else if (ctrl && e.key === 'v') {
        e.preventDefault();
        pasteClipboard();
      } else if (ctrl && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupSelected();
      } else if (ctrl && e.key === 'g' && e.shiftKey) {
        e.preventDefault();
        ungroupSelected();
      } else if (ctrl && e.key === 'd') {
        e.preventDefault();
        copySelected();
        setTimeout(() => pasteClipboard(), 50);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, undo, redo, copySelected, pasteClipboard, groupSelected, ungroupSelected]);

  useEffect(() => {
    if (searchParams.get('room')) return;
    const next = new URLSearchParams(searchParams);
    next.set('room', roomId);
    setSearchParams(next, { replace: true });
  }, [roomId, searchParams, setSearchParams]);

  useEffect(() => {
    let mounted = true;
    if (!canvasReady) return;
    setCollabStatus('connecting');
    api.editor.collaborationAccess()
      .then(() => {
        if (!mounted) return;
        setCollabEnabled(true);
      })
      .catch(() => {
        if (!mounted) return;
        setCollabEnabled(false);
        setCollabStatus('blocked');
        setCollabUsers([]);
      });
    return () => {
      mounted = false;
    };
  }, [canvasReady]);

  useEffect(() => {
    if (!canvasReady || !collabEnabled) return;
    setCollabStatus('connecting');
    const streamUrl = api.editor.collaborationStreamUrl(roomId, collabClientIdRef.current);
    const source = new EventSource(streamUrl, { withCredentials: true });

    const onConnected = () => {
      setCollabStatus('connected');
    };

    const onPresence = (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data || '{}');
        const users = Array.isArray(data?.users) ? data.users : [];
        setCollabUsers(
          users.filter((user: CollabUser) => user.id !== collabClientIdRef.current),
        );
      } catch {
        // Ignore malformed SSE payloads
      }
    };

    const onCanvasUpdate = (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data || '{}');
        if (data?.clientId === collabClientIdRef.current) return;
        const json = data?.payload?.json;
        if (typeof json !== 'string') return;
        applyingRemoteUpdateRef.current = true;
        loadJSON(json);
        window.setTimeout(() => {
          applyingRemoteUpdateRef.current = false;
        }, 300);
      } catch {
        // Ignore malformed SSE payloads
      }
    };

    source.addEventListener('connected', onConnected as EventListener);
    source.addEventListener('presence', onPresence as EventListener);
    source.addEventListener('canvas:update', onCanvasUpdate as EventListener);
    source.onerror = () => {
      setCollabStatus('error');
      source.close();
    };

    return () => {
      source.removeEventListener('connected', onConnected as EventListener);
      source.removeEventListener('presence', onPresence as EventListener);
      source.removeEventListener('canvas:update', onCanvasUpdate as EventListener);
      source.close();
    };
  }, [canvasReady, collabEnabled, loadJSON, roomId]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !canvasReady || !collabEnabled || collabStatus !== 'connected') return;

    const schedulePublish = () => {
      if (applyingRemoteUpdateRef.current) return;
      if (publishTimerRef.current) window.clearTimeout(publishTimerRef.current);
      publishTimerRef.current = window.setTimeout(async () => {
        try {
          await api.editor.collaborationPublish(roomId, collabClientIdRef.current, {
            json: toJSON(),
            userName: currentUser?.name || 'Collaborator',
          });
        } catch {
          // Ignore publish failures for now (connection may be transient)
        }
      }, 180);
    };

    c.on('object:added', schedulePublish);
    c.on('object:modified', schedulePublish);
    c.on('object:removed', schedulePublish);
    c.on('text:changed', schedulePublish);

    return () => {
      c.off('object:added', schedulePublish);
      c.off('object:modified', schedulePublish);
      c.off('object:removed', schedulePublish);
      c.off('text:changed', schedulePublish);
      if (publishTimerRef.current) {
        window.clearTimeout(publishTimerRef.current);
      }
    };
  }, [canvas, canvasReady, collabEnabled, collabStatus, currentUser?.name, roomId, toJSON]);

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

  // Drag-and-drop handlers for canvas area
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => addImage(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  }, [addImage]);

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

  async function handleSendToCompose() {
    const dataUrl = exportImage('png');
    if (!dataUrl) return;

    setSendingToCompose(true);
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `postmind-${platform}-${postType}.png`, { type: 'image/png' });
      const upload = await api.posts.uploadMedia(file);

      saveComposeSeed({
        source: 'editor',
        media: [upload.data],
      });
      navigate('/compose');
    } catch (err: any) {
      window.alert(err.message || 'Failed to send design to Compose');
    } finally {
      setSendingToCompose(false);
    }
  }

  const handleLoadTemplate = useCallback((template: TemplateData) => {
    resizeCanvas({ width: template.width, height: template.height, label: template.name });
    loadJSON(template.json);
    setShowTemplates(false);
  }, [loadJSON, resizeCanvas]);

  useEffect(() => {
    if (!canvasReady || !initialTemplateId) return;
    if (loadedQueryTemplateIdRef.current === initialTemplateId) return;
    const template = TEMPLATES.find((item) => item.id === initialTemplateId);
    if (!template) return;
    loadedQueryTemplateIdRef.current = initialTemplateId;
    handleLoadTemplate(template);
  }, [canvasReady, handleLoadTemplate, initialTemplateId]);

  function handleBgChange(color: string) {
    setBgColor(color);
    setBackground(color);
  }

  async function handleImageSearch() {
    if (!imageQuery.trim()) return;
    setImageSearchLoading(true);
    try {
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

  // Image fine-tuning handlers
  function handleBrightnessChange(val: number) {
    setBrightness(val);
    applyImageFilter('brightness', val);
  }
  function handleContrastChange(val: number) {
    setContrast(val);
    applyImageFilter('contrast', val);
  }
  function handleSaturationChange(val: number) {
    setSaturation(val);
    applyImageFilter('saturation', val);
  }
  function handlePresetFilter(preset: string) {
    clearImageFilters();
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    if (preset !== 'none') {
      applyImageFilter(preset);
    }
  }

  // Background removal handler
  async function handleBackgroundRemoval() {
    const c = canvas.current;
    if (!c) return;
    const obj = c.getActiveObject();
    if (!obj) return;
    setBgRemovalLoading(true);
    try {
      // Export the selected image to blob
      const dataUrl = (obj as any).toDataURL?.({ format: 'png', multiplier: 1 });
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const formData = new FormData();
      formData.append('image_file', blob, 'image.png');
      formData.append('size', 'auto');
      const resultBlob = await api.editor.removeBackground(formData);
      const url = URL.createObjectURL(resultBlob);
      addImage(url);
      c.remove(obj);
      c.requestRenderAll();
    } catch {
      // Silently fail
    } finally {
      setBgRemovalLoading(false);
    }
  }

  async function handleCopyCollaborationLink() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      await navigator.clipboard.writeText(url.toString());
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1200);
    } catch {
      setShareCopied(false);
    }
  }

  function handleCropPreset(mode: 'square' | 'portrait' | 'landscape' | 'reset') {
    if (mode === 'reset') {
      resetActiveImageCrop();
      return;
    }
    const aspect = mode === 'square' ? 1 : mode === 'portrait' ? 4 / 5 : 16 / 9;
    cropActiveImageToAspect(aspect);
  }

  const objects = getObjects();
  const displayW = size.width * SCALE_FACTOR;
  const displayH = size.height * SCALE_FACTOR;

  // Toolbar button helper
  const TBtn = ({ onClick, title, children, disabled, danger }: {
    onClick: () => void; title: string; children: React.ReactNode;
    disabled?: boolean; danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${danger ? 'hover:bg-red-50' : 'hover:bg-neutral-100'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Design Editor</h1>
          <p className="text-sm text-neutral-500 mt-1">{size.label} — {size.width}×{size.height}px</p>
        </div>
        <div className="flex gap-2 items-center">
          {(collabEnabled || collabStatus === 'blocked' || collabStatus === 'error') && (
            <Badge variant={collabStatus === 'connected' ? 'success' : collabStatus === 'blocked' ? 'warning' : 'default'}>
              {collabStatus === 'connected'
                ? 'Collab Live'
                : collabStatus === 'blocked'
                  ? 'Team Plan Required'
                  : collabStatus === 'error'
                    ? 'Collab Offline'
                    : 'Collab Connecting'}
            </Badge>
          )}
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
          {collabEnabled && (
            <Button variant="secondary" size="sm" onClick={handleCopyCollaborationLink}>
              <Link2 className="w-4 h-4" /> {shareCopied ? 'Copied' : 'Share Link'}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(true)}>
            <Save className="w-4 h-4" /> Save Template
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowTemplates(!showTemplates)}>
            <LayoutTemplate className="w-4 h-4" /> Templates
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSendToCompose} loading={sendingToCompose}>
            <Send className="w-4 h-4" /> Send to Compose
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
          <TBtn onClick={() => addText()} title="Add Text (T)"><Type className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => addShape('rect')} title="Rectangle"><Square className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => addShape('circle')} title="Circle"><Circle className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => addShape('line')} title="Line"><Minus className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => addShape('arrow')} title="Arrow"><MoveRight className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => fileInputRef.current?.click()} title="Upload Image"><ImageIcon className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => setShowImageSearch(!showImageSearch)} title="Search Images"><Search className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => setShowIconLibrary(true)} title="Icon Library"><Smile className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => setShowFrameLibrary(true)} title="Frame Library"><Frame className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => { const p = prompt('Describe the image to generate:'); if (p) { setAiImagePrompt(p); handleAiImageGenerate(); } }} title="AI Generate">
            <Sparkles className="w-5 h-5 text-neutral-600" />
          </TBtn>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

          <div className="w-8 h-px bg-neutral-200" />
          <TBtn onClick={copySelected} title="Copy (Ctrl+C)"><Copy className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={pasteClipboard} title="Paste (Ctrl+V)"><ClipboardPaste className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={groupSelected} title="Group (Ctrl+G)"><Group className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={ungroupSelected} title="Ungroup (Ctrl+Shift+G)"><Ungroup className="w-5 h-5 text-neutral-600" /></TBtn>

          <div className="w-8 h-px bg-neutral-200" />
          <TBtn onClick={undo} title="Undo (Ctrl+Z)" disabled={!canUndo}><Undo2 className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={redo} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo}><Redo2 className="w-5 h-5 text-neutral-600" /></TBtn>

          <div className="w-8 h-px bg-neutral-200" />
          <TBtn onClick={bringToFront} title="Bring to Front"><ChevronsUp className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={bringForward} title="Bring Forward"><ArrowUp className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={sendBackward} title="Send Backward"><ArrowDown className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={sendToBack} title="Send to Back"><ChevronsDown className="w-5 h-5 text-neutral-600" /></TBtn>

          <div className="w-8 h-px bg-neutral-200" />
          <TBtn onClick={() => setShowLayers(!showLayers)} title="Layers Panel">
            <Layers className={`w-5 h-5 ${showLayers ? 'text-brand-blue' : 'text-neutral-600'}`} />
          </TBtn>
          {activeObjType === 'image' && (
            <>
              <TBtn onClick={() => setShowCropTools(!showCropTools)} title="Crop Tools">
                <Scissors className={`w-5 h-5 ${showCropTools ? 'text-brand-blue' : 'text-neutral-600'}`} />
              </TBtn>
              <TBtn onClick={() => rotateSelected(-90)} title="Rotate Left">
                <RotateCcw className="w-5 h-5 text-neutral-600" />
              </TBtn>
              <TBtn onClick={() => rotateSelected(90)} title="Rotate Right">
                <RotateCw className="w-5 h-5 text-neutral-600" />
              </TBtn>
              <TBtn onClick={() => setShowImageTuning(!showImageTuning)} title="Image Tuning">
                <SunMedium className={`w-5 h-5 ${showImageTuning ? 'text-brand-blue' : 'text-neutral-600'}`} />
              </TBtn>
              <TBtn onClick={handleBackgroundRemoval} title="Remove Background" disabled={bgRemovalLoading}>
                <Eraser className="w-5 h-5 text-neutral-600" />
              </TBtn>
            </>
          )}

          <div className="w-8 h-px bg-neutral-200" />
          <TBtn onClick={deleteSelected} title="Delete (Del)" danger><Trash2 className="w-5 h-5 text-red-500" /></TBtn>
        </Card>

        {/* Canvas with drag-and-drop */}
        <div className="flex-1 flex justify-center">
          <div
            ref={canvasAreaRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-white border-2 rounded-lg shadow-sm overflow-hidden transition-colors ${
              dragActive ? 'border-brand-blue bg-brand-blue/5' : 'border-neutral-200'
            }`}
            style={{ width: displayW, height: displayH, position: 'relative' }}
          >
            {dragActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand-blue/10 pointer-events-none">
                <div className="text-brand-blue font-medium text-sm flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" /> Drop image here
                </div>
              </div>
            )}
            <div style={{ transform: `scale(${SCALE_FACTOR})`, transformOrigin: 'top left' }}>
              <canvas id="editor-canvas" />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-60 space-y-3 overflow-y-auto max-h-[80vh]">
          {/* Platform & Size */}
          <Card className="p-4 space-y-4">
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
          </Card>

          {/* Background */}
          <Card className="p-4 space-y-3">
            <label className="block text-xs font-medium text-neutral-500">Background</label>
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
            <label className="block text-xs font-medium text-neutral-500 mt-2">Gradients</label>
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
          </Card>

          {/* Quick Add */}
          <Card className="p-4 space-y-2">
            <label className="block text-xs font-medium text-neutral-500 mb-1">Quick Add</label>
            <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Heading', { fontSize: 48, fontWeight: 'bold', fontFamily: selectedFont } as any)}>
              + Heading
            </Button>
            <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Body text', { fontSize: 24, fontFamily: selectedFont } as any)}>
              + Body Text
            </Button>
            <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Caption', { fontSize: 18, fill: '#6B7280', fontFamily: selectedFont } as any)}>
              + Caption
            </Button>
          </Card>

          {/* Image Crop Tools (contextual) */}
          {showCropTools && activeObjType === 'image' && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-700 flex items-center gap-1">
                  <Scissors className="w-3.5 h-3.5" /> Crop & Rotate
                </label>
                <button onClick={() => setShowCropTools(false)} className="p-0.5 rounded hover:bg-neutral-100">
                  <X className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleCropPreset('square')}
                  className="px-2 py-1.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                >
                  1:1 Square
                </button>
                <button
                  onClick={() => handleCropPreset('portrait')}
                  className="px-2 py-1.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                >
                  4:5 Portrait
                </button>
                <button
                  onClick={() => handleCropPreset('landscape')}
                  className="px-2 py-1.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                >
                  16:9 Wide
                </button>
                <button
                  onClick={() => handleCropPreset('reset')}
                  className="px-2 py-1.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                >
                  Reset Crop
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" variant="secondary" className="text-xs" onClick={() => rotateSelected(-90)}>
                  <RotateCcw className="w-3.5 h-3.5" /> Left
                </Button>
                <Button size="sm" variant="secondary" className="text-xs" onClick={() => rotateSelected(90)}>
                  <RotateCw className="w-3.5 h-3.5" /> Right
                </Button>
              </div>
            </Card>
          )}

          {/* Image Fine-Tuning (contextual) */}
          {showImageTuning && activeObjType === 'image' && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-700">Image Tuning</label>
                <button onClick={() => setShowImageTuning(false)} className="p-0.5 rounded hover:bg-neutral-100">
                  <X className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-neutral-500 flex items-center gap-1"><SunMedium className="w-3 h-3" /> Brightness</span>
                  <span className="text-[10px] text-neutral-400">{Math.round(brightness * 100)}%</span>
                </div>
                <input type="range" min="-1" max="1" step="0.05" value={brightness}
                  onChange={(e) => handleBrightnessChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-brand-blue" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-neutral-500 flex items-center gap-1"><Contrast className="w-3 h-3" /> Contrast</span>
                  <span className="text-[10px] text-neutral-400">{Math.round(contrast * 100)}%</span>
                </div>
                <input type="range" min="-1" max="1" step="0.05" value={contrast}
                  onChange={(e) => handleContrastChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-brand-blue" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-neutral-500 flex items-center gap-1"><Droplets className="w-3 h-3" /> Saturation</span>
                  <span className="text-[10px] text-neutral-400">{Math.round(saturation * 100)}%</span>
                </div>
                <input type="range" min="-1" max="1" step="0.05" value={saturation}
                  onChange={(e) => handleSaturationChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-brand-blue" />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 mb-1.5">Preset Filters</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { label: 'None', value: 'none' },
                    { label: 'B&W', value: 'grayscale' },
                    { label: 'Sepia', value: 'sepia' },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => handlePresetFilter(p.value)}
                      className="px-2 py-1 rounded-md text-[10px] font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => { clearImageFilters(); setBrightness(0); setContrast(0); setSaturation(0); }}>
                Reset All Filters
              </Button>
            </Card>
          )}

          {/* Layer Management Panel */}
          {showLayers && (
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-neutral-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Layers ({objects.length})
                </label>
                <button onClick={() => setShowLayers(false)} className="p-0.5 rounded hover:bg-neutral-100">
                  <X className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {[...objects].reverse().map((obj, idx) => {
                  const realIdx = objects.length - 1 - idx;
                  const objType = (obj as any).type || 'object';
                  const isText = objType === 'i-text' || objType === 'text';
                  const label = isText ? ((obj as any).text || 'Text').slice(0, 18) : `${objType} ${realIdx + 1}`;
                  const isLocked = obj.lockMovementX;

                  return (
                    <div
                      key={realIdx}
                      onClick={() => selectObject(obj)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] hover:bg-neutral-50 cursor-pointer group transition-colors"
                    >
                      <span className="flex-1 truncate text-neutral-700">{label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleObjectVisibility(obj); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-neutral-200 transition-opacity"
                        title={obj.visible === false ? 'Show' : 'Hide'}
                      >
                        {obj.visible === false ? <EyeOff className="w-3 h-3 text-neutral-400" /> : <Eye className="w-3 h-3 text-neutral-500" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleObjectLock(obj); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-neutral-200 transition-opacity"
                        title={isLocked ? 'Unlock' : 'Lock'}
                      >
                        {isLocked ? <Lock className="w-3 h-3 text-neutral-400" /> : <Unlock className="w-3 h-3 text-neutral-500" />}
                      </button>
                    </div>
                  );
                })}
                {objects.length === 0 && (
                  <p className="text-[10px] text-neutral-400 text-center py-2">No objects on canvas</p>
                )}
              </div>
            </Card>
          )}
        </div>
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
                    <div className="relative aspect-square overflow-hidden">
                      <TemplatePreview template={t} className="h-full w-full object-contain bg-neutral-50" alt={`${t.name} template preview`} />
                      <div className="absolute inset-x-0 bottom-0 p-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/30 text-white backdrop-blur-sm">
                          {t.width}×{t.height}
                        </span>
                      </div>
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

      {/* Image search modal */}
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

      {/* Save as template modal */}
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

      {/* Icon Library Modal */}
      {showIconLibrary && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h2 className="text-lg font-heading font-bold text-neutral-900">Icon Library</h2>
              <button onClick={() => setShowIconLibrary(false)} className="p-1 rounded hover:bg-neutral-100">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {ICON_LIBRARY.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => { addSvgString(item.svg); setShowIconLibrary(false); }}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-neutral-200 hover:border-brand-blue hover:shadow-md transition-all hover:bg-neutral-50"
                    >
                      <Icon className="w-6 h-6 text-neutral-700" />
                      <span className="text-[9px] text-neutral-500 truncate w-full text-center">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Frame Library Modal */}
      {showFrameLibrary && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h2 className="text-lg font-heading font-bold text-neutral-900">Frame Library</h2>
              <button onClick={() => setShowFrameLibrary(false)} className="p-1 rounded hover:bg-neutral-100">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {FRAME_LIBRARY.map((frame) => (
                  <button
                    key={frame.name}
                    onClick={() => { addSvgString(frame.svg); setShowFrameLibrary(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-neutral-200 hover:border-brand-blue hover:shadow-md transition-all hover:bg-neutral-50"
                  >
                    <div className="w-14 h-14" dangerouslySetInnerHTML={{ __html: frame.svg.replace(/width="200"/g, 'width="56"').replace(/height="200"/g, 'height="56"') }} />
                    <span className="text-[9px] text-neutral-500 truncate w-full text-center">{frame.name}</span>
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
