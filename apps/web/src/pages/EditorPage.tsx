import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Badge } from '@/components/ui';
import { TemplatePreview } from '@/components/TemplatePreview';
import { useCanvas, type CanvasSize, type PhotoFrameType } from '@/hooks/useCanvas';
import { CANVAS_SIZES, getCanvasSize, getAvailablePostTypes } from '@/lib/canvasSizes';
import { TEMPLATES, getCategories, getTemplatesByCategory, type TemplateData } from '@/lib/templates';
import { SCENE_SHAPES } from '@/lib/sceneShapes';
import { saveComposeSeed } from '@/lib/composeSeed';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'react-hot-toast';
import {
  Type, Square, Circle, Minus, MoveRight, ImageIcon, Undo2, Redo2, Trash2,
  Download, Layers, ArrowUp, ArrowDown, Palette, LayoutTemplate,
  ChevronDown, X, Search, Sparkles, Save, FileText, Users,
  Copy, ClipboardPaste, Group, Ungroup, Eye, EyeOff, Lock, Unlock,
  SunMedium, Contrast, Droplets, Eraser, Frame, Smile, ChevronsUp, ChevronsDown,
  Monitor, Radio, Car, Smartphone, Coffee, Music, Camera, Heart, Star, Zap,
  Globe, MapPin, ShoppingBag, Briefcase, Megaphone, Pen, BookOpen, Cpu, Wifi,
  Scissors, RotateCcw, RotateCw, Link2, Send, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  Clock, CheckCircle2,
} from 'lucide-react';

const GOOGLE_FONTS = [
  'Inter', 'Poppins', 'Roboto', 'Montserrat', 'Open Sans', 'Lato',
  'Playfair Display', 'Raleway', 'Oswald', 'Merriweather', 'Nunito',
  'Source Sans 3', 'PT Sans', 'Ubuntu', 'Bebas Neue',
];

const BACKGROUND_COLORS_BASE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#111827', '#334155', '#475569',
  '#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff',
  '#7f1d1d', '#7c2d12', '#78350f', '#365314', '#14532d',
  '#064e3b', '#134e4a', '#164e63', '#1e3a8a', '#312e81',
  '#4c1d95', '#701a75', '#831843', '#fca5a5', '#fdba74',
  '#fcd34d', '#bef264', '#86efac', '#6ee7b7', '#67e8f9',
  '#93c5fd', '#a5b4fc', '#c4b5fd', '#f0abfc', '#f9a8d4',
];

const BACKGROUND_COLORS_EXTRA = [
  '#020617', '#0f172a', '#1f2937', '#374151', '#4b5563',
  '#52525b', '#71717a', '#a1a1aa', '#e4e4e7', '#fafafa',
  '#7c3aed', '#6d28d9', '#5b21b6', '#581c87', '#86198f',
  '#a21caf', '#c026d3', '#e879f9', '#f0f9ff', '#bae6fd',
  '#7dd3fc', '#38bdf8', '#0284c7', '#0369a1', '#0c4a6e',
  '#083344', '#042f2e', '#115e59', '#0f766e', '#0d9488',
  '#2dd4bf', '#99f6e4', '#ccfbf1', '#052e16', '#166534',
  '#15803d', '#16a34a', '#4ade80', '#bbf7d0', '#dcfce7',
  '#3f6212', '#65a30d', '#a3e635', '#facc15', '#fef08a',
  '#fde047', '#fef9c3', '#422006', '#713f12', '#92400e',
];

const BACKGROUND_COLORS = [...BACKGROUND_COLORS_BASE, ...BACKGROUND_COLORS_EXTRA];

const GRADIENT_PRESETS_BASE = [
  { label: 'Ruby Fire', value: 'linear(#ef4444, #f97316)' },
  { label: 'Sunset Gold', value: 'linear(#f97316, #f59e0b)' },
  { label: 'Solar Punch', value: 'linear(#f59e0b, #eab308)' },
  { label: 'Lime Spark', value: 'linear(#eab308, #84cc16)' },
  { label: 'Green Pulse', value: 'linear(#84cc16, #22c55e)' },
  { label: 'Emerald Sea', value: 'linear(#22c55e, #10b981)' },
  { label: 'Mint Aqua', value: 'linear(#10b981, #14b8a6)' },
  { label: 'Aqua Sky', value: 'linear(#14b8a6, #06b6d4)' },
  { label: 'Ocean Pop', value: 'linear(#06b6d4, #0ea5e9)' },
  { label: 'Blue Blaze', value: 'linear(#0ea5e9, #3b82f6)' },
  { label: 'Indigo Beam', value: 'linear(#3b82f6, #6366f1)' },
  { label: 'Violet Dream', value: 'linear(#6366f1, #8b5cf6)' },
  { label: 'Purple Pop', value: 'linear(#8b5cf6, #a855f7)' },
  { label: 'Orchid Glow', value: 'linear(#a855f7, #d946ef)' },
  { label: 'Pink Neon', value: 'linear(#d946ef, #ec4899)' },
  { label: 'Rose Candy', value: 'linear(#ec4899, #f43f5e)' },
  { label: 'Cherry Burst', value: 'linear(#f43f5e, #ef4444)' },
  { label: 'Midnight Blue', value: 'linear(#111827, #1e3a8a)' },
  { label: 'Slate Steel', value: 'linear(#334155, #475569)' },
  { label: 'Charcoal Fade', value: 'linear(#475569, #111827)' },
  { label: 'Silver Shine', value: 'linear(#6b7280, #e5e7eb, #9ca3af)' },
  { label: 'Platinum Gloss', value: 'linear(#9ca3af, #f3f4f6, #d1d5db)' },
  { label: 'Graphite Metal', value: 'linear(#111827, #6b7280, #374151)' },
  { label: 'Gold Luxe', value: 'linear(#a16207, #facc15, #fef3c7)' },
  { label: 'Rose Gold', value: 'linear(#b45309, #f59e0b, #fbcfe8)' },
  { label: 'Bronze Rich', value: 'linear(#7c2d12, #b45309, #fde68a)' },
  { label: 'Copper Glow', value: 'linear(#9a3412, #f97316, #fdba74)' },
  { label: 'Royal Gold', value: 'linear(#78350f, #d97706, #fef3c7)' },
  { label: 'Sapphire Gloss', value: 'linear(#1e3a8a, #60a5fa, #1d4ed8)' },
  { label: 'Emerald Gloss', value: 'linear(#14532d, #34d399, #047857)' },
  { label: 'Ruby Gloss', value: 'linear(#7f1d1d, #f87171, #991b1b)' },
  { label: 'Violet Gloss', value: 'linear(#4c1d95, #c4b5fd, #6d28d9)' },
  { label: 'Teal Gloss', value: 'linear(#134e4a, #5eead4, #0f766e)' },
  { label: 'Candy Pop 3', value: 'linear(#ef4444, #f59e0b, #eab308)' },
  { label: 'Tropical Pop 3', value: 'linear(#22c55e, #06b6d4, #3b82f6)' },
  { label: 'Unicorn Pop 3', value: 'linear(#8b5cf6, #ec4899, #f43f5e)' },
  { label: 'Aurora 3', value: 'linear(#06b6d4, #8b5cf6, #ec4899)' },
  { label: 'Festival 3', value: 'linear(#f97316, #ec4899, #8b5cf6)' },
  { label: 'Lagoon 3', value: 'linear(#0ea5e9, #14b8a6, #22c55e)' },
  { label: 'Heatwave 3', value: 'linear(#ef4444, #f97316, #f59e0b)' },
  { label: 'Cosmic 3', value: 'linear(#111827, #312e81, #701a75)' },
  { label: 'Forest 3', value: 'linear(#365314, #22c55e, #84cc16)' },
  { label: 'Ocean Deep 3', value: 'linear(#164e63, #0ea5e9, #67e8f9)' },
  { label: 'Candy Gloss 3', value: 'linear(#f43f5e, #ffffff, #ec4899)' },
  { label: 'Blue Gloss 3', value: 'linear(#2563eb, #ffffff, #1d4ed8)' },
  { label: 'Mint Gloss 3', value: 'linear(#10b981, #ffffff, #059669)' },
  { label: 'Gold Gloss 3', value: 'linear(#d97706, #ffffff, #f59e0b)' },
  { label: 'Silver Gloss 3', value: 'linear(#6b7280, #ffffff, #9ca3af)' },
  { label: 'Pearl Shine 3', value: 'linear(#d1d5db, #ffffff, #f3f4f6)' },
  { label: 'Rainbow Rich 3', value: 'linear(#ef4444, #f59e0b, #3b82f6)' },
];

const GRADIENT_PRESETS_EXTRA = [
  { label: 'Obsidian Glow', value: 'linear(#020617, #1f2937, #4b5563)' },
  { label: 'Steel Night', value: 'linear(#0f172a, #374151, #a1a1aa)' },
  { label: 'Graphite Luxe', value: 'linear(#111827, #374151, #e4e4e7)' },
  { label: 'Deep Indigo', value: 'linear(#312e81, #5b21b6, #7c3aed)' },
  { label: 'Royal Purple', value: 'linear(#581c87, #86198f, #a21caf)' },
  { label: 'Ultra Violet', value: 'linear(#5b21b6, #7c3aed)' },
  { label: 'Neon Orchid', value: 'linear(#a21caf, #e879f9)' },
  { label: 'Candy Violet', value: 'linear(#6d28d9, #c026d3, #f0abfc)' },
  { label: 'Sky Prism', value: 'linear(#bae6fd, #38bdf8, #0369a1)' },
  { label: 'Lagoon Surge', value: 'linear(#0c4a6e, #06b6d4, #99f6e4)' },
  { label: 'Ocean Glass', value: 'linear(#083344, #0284c7, #f0f9ff)' },
  { label: 'Arctic Blue', value: 'linear(#f0f9ff, #7dd3fc, #3b82f6)' },
  { label: 'Teal Spark', value: 'linear(#042f2e, #0d9488, #2dd4bf)' },
  { label: 'Mint Ice', value: 'linear(#ccfbf1, #99f6e4, #2dd4bf)' },
  { label: 'Emerald Forest', value: 'linear(#052e16, #166534, #4ade80)' },
  { label: 'Green Shine', value: 'linear(#14532d, #16a34a, #dcfce7)' },
  { label: 'Lime Burst', value: 'linear(#3f6212, #84cc16, #fef08a)' },
  { label: 'Citrus Pop', value: 'linear(#65a30d, #a3e635, #facc15)' },
  { label: 'Amber Rich', value: 'linear(#713f12, #f59e0b, #fde047)' },
  { label: 'Honey Glow', value: 'linear(#92400e, #facc15, #fef9c3)' },
  { label: 'Copper Metal', value: 'linear(#7c2d12, #92400e, #fdba74)' },
  { label: 'Bronze Metal', value: 'linear(#422006, #b45309, #fcd34d)' },
  { label: 'Ruby Metal', value: 'linear(#7f1d1d, #ef4444, #fca5a5)' },
  { label: 'Rose Quartz', value: 'linear(#831843, #ec4899, #f9a8d4)' },
  { label: 'Magenta Gloss', value: 'linear(#86198f, #d946ef, #ffffff)' },
  { label: 'Blue Gloss X', value: 'linear(#1e3a8a, #38bdf8, #ffffff)' },
  { label: 'Emerald Gloss X', value: 'linear(#166534, #2dd4bf, #ffffff)' },
  { label: 'Golden Gloss X', value: 'linear(#92400e, #fde047, #ffffff)' },
  { label: 'Silver Frost', value: 'linear(#6b7280, #e4e4e7, #ffffff)' },
  { label: 'Pearl Night', value: 'linear(#334155, #f3f4f6, #ffffff)' },
  { label: 'Storm Gray', value: 'linear(#111827, #6b7280, #d1d5db)' },
  { label: 'Twilight Blend', value: 'linear(#0f172a, #312e81, #701a75)' },
  { label: 'Aurora Boreal', value: 'linear(#115e59, #22c55e, #a3e635)' },
  { label: 'Aurora Magenta', value: 'linear(#0ea5e9, #8b5cf6, #e879f9)' },
  { label: 'Rainbow Prism', value: 'linear(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1)' },
  { label: 'Sunset Neon', value: 'linear(#f43f5e, #f97316, #facc15)' },
  { label: 'Tropical Neon', value: 'linear(#10b981, #06b6d4, #7c3aed)' },
  { label: 'Velvet Night', value: 'linear(#1f2937, #4c1d95, #831843)' },
  { label: 'Cyber Glow', value: 'linear(#020617, #0369a1, #06b6d4)' },
  { label: 'Electric Mint', value: 'linear(#0f766e, #14b8a6, #67e8f9)' },
  { label: 'Emerald Gold', value: 'linear(#166534, #facc15, #fef9c3)' },
  { label: 'Sapphire Gold', value: 'linear(#1e3a8a, #f59e0b, #fde68a)' },
  { label: 'Ruby Sapphire', value: 'linear(#ef4444, #312e81, #3b82f6)' },
  { label: 'Mint Rose', value: 'linear(#10b981, #ec4899, #f9a8d4)' },
  { label: 'Cosmic Candy', value: 'linear(#6d28d9, #ec4899, #f97316)' },
  { label: 'Lime Sky', value: 'linear(#84cc16, #06b6d4, #93c5fd)' },
  { label: 'Coral Bloom', value: 'linear(#f97316, #f43f5e, #f0abfc)' },
  { label: 'Obsidian Pearl', value: 'linear(#020617, #4b5563, #fafafa)' },
  { label: 'Glacier Shine', value: 'linear(#bae6fd, #ffffff, #7dd3fc)' },
  { label: 'Forest Bronze', value: 'linear(#14532d, #92400e, #fcd34d)' },
];

const GRADIENT_PRESETS = [...GRADIENT_PRESETS_BASE, ...GRADIENT_PRESETS_EXTRA];

const SHAPE_COLOR_SWATCHES = [
  '#111827', '#374151', '#6b7280', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ffffff',
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

type CanvasShapeType = 'rect' | 'circle' | 'line' | 'arrow';
type ShapeLibraryItem = { name: string; kind: 'native' | 'svg'; shapeType?: CanvasShapeType; svg: string };
type FrameLibraryItem = { name: string; svg: string; kind?: 'svg' | 'photo'; photoType?: PhotoFrameType };
type SidebarPanel = 'platform' | 'background' | 'assets' | 'quick' | 'text' | 'shape' | 'crop' | 'tune' | 'layers';

const PHOTO_FRAME_LIBRARY: FrameLibraryItem[] = [
  { name: 'Photo Frame - Rectangle', kind: 'photo', photoType: 'rect', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="16" y="26" width="168" height="138" rx="10" fill="#f8fafc" stroke="#111827" stroke-width="4"/><path d="M32 142 76 98l34 30 22-22 36 36" fill="none" stroke="#94a3b8" stroke-width="5"/><circle cx="70" cy="70" r="10" fill="#cbd5e1"/></svg>' },
  { name: 'Photo Frame - Rounded', kind: 'photo', photoType: 'rounded', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="14" y="22" width="172" height="144" rx="28" fill="#f8fafc" stroke="#111827" stroke-width="4"/><path d="M30 146 84 92l30 26 28-24 28 52" fill="none" stroke="#94a3b8" stroke-width="5"/><circle cx="76" cy="72" r="10" fill="#cbd5e1"/></svg>' },
  { name: 'Photo Frame - Circle', kind: 'photo', photoType: 'circle', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="78" fill="#f8fafc" stroke="#111827" stroke-width="4"/><path d="M44 132 84 98l22 16 24-24 26 42" fill="none" stroke="#94a3b8" stroke-width="5"/><circle cx="82" cy="76" r="9" fill="#cbd5e1"/></svg>' },
  { name: 'Photo Frame - Diamond', kind: 'photo', photoType: 'diamond', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><polygon points="100,18 182,100 100,182 18,100" fill="#f8fafc" stroke="#111827" stroke-width="4"/><path d="M50 128 84 94l20 16 26-24 20 42" fill="none" stroke="#94a3b8" stroke-width="5"/><circle cx="84" cy="74" r="9" fill="#cbd5e1"/></svg>' },
  { name: 'Photo Frame - Hex', kind: 'photo', photoType: 'hex', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><polygon points="56,20 144,20 186,100 144,180 56,180 14,100" fill="#f8fafc" stroke="#111827" stroke-width="4"/><path d="M40 136 84 94l28 24 18-18 30 36" fill="none" stroke="#94a3b8" stroke-width="5"/><circle cx="78" cy="74" r="9" fill="#cbd5e1"/></svg>' },
  { name: 'Photo Frame - Arch', kind: 'photo', photoType: 'arch', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M24 174V94Q100 14 176 94V174Z" fill="#f8fafc" stroke="#111827" stroke-width="4"/><path d="M46 148 80 108l22 20 24-22 28 42" fill="none" stroke="#94a3b8" stroke-width="5"/><circle cx="80" cy="82" r="9" fill="#cbd5e1"/></svg>' },
  { name: 'Photo Frame - Ticket', kind: 'photo', photoType: 'ticket', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M20 44h160v30q-20 12 0 24v60H20V98q20-12 0-24z" fill="#f8fafc" stroke="#111827" stroke-width="4"/><path d="M40 138 82 94l24 20 24-24 28 48" fill="none" stroke="#94a3b8" stroke-width="5"/><circle cx="78" cy="74" r="9" fill="#cbd5e1"/></svg>' },
  { name: 'Photo Frame - Capsule', kind: 'photo', photoType: 'capsule', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="10" y="50" width="180" height="100" rx="50" fill="#f8fafc" stroke="#111827" stroke-width="4"/><path d="M38 128 80 96l22 18 22-20 36 38" fill="none" stroke="#94a3b8" stroke-width="5"/><circle cx="80" cy="84" r="9" fill="#cbd5e1"/></svg>' },
];

// Decorative frame SVGs
const FRAME_LIBRARY_BASE: FrameLibraryItem[] = [
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
  { name: 'Photo Matte', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="4" y="4" width="192" height="192" fill="#111827"/><rect x="20" y="20" width="160" height="160" fill="#ffffff"/><rect x="28" y="28" width="144" height="144" fill="none" stroke="#111827" stroke-width="2"/></svg>' },
  { name: 'Polaroid Classic', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="18" y="10" width="164" height="180" rx="6" fill="#ffffff" stroke="#d1d5db" stroke-width="2"/><rect x="32" y="24" width="136" height="118" fill="none" stroke="#111827" stroke-width="2"/><rect x="52" y="154" width="96" height="22" rx="4" fill="#f3f4f6"/></svg>' },
  { name: 'Film Strip', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="8" y="8" width="184" height="184" rx="8" fill="#111827"/><rect x="28" y="28" width="144" height="144" fill="none" stroke="#ffffff" stroke-width="2"/><g fill="#ffffff"><rect x="16" y="18" width="10" height="14"/><rect x="16" y="42" width="10" height="14"/><rect x="16" y="66" width="10" height="14"/><rect x="16" y="90" width="10" height="14"/><rect x="16" y="114" width="10" height="14"/><rect x="16" y="138" width="10" height="14"/><rect x="16" y="162" width="10" height="14"/><rect x="174" y="18" width="10" height="14"/><rect x="174" y="42" width="10" height="14"/><rect x="174" y="66" width="10" height="14"/><rect x="174" y="90" width="10" height="14"/><rect x="174" y="114" width="10" height="14"/><rect x="174" y="138" width="10" height="14"/><rect x="174" y="162" width="10" height="14"/></g></svg>' },
  { name: 'Ticket Cutout', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M20 20h160v42a14 14 0 010 28v20a14 14 0 010 28v42H20v-42a14 14 0 010-28V90a14 14 0 010-28V20z" fill="none" stroke="#111827" stroke-width="3"/><path d="M100 20v160" stroke="#9ca3af" stroke-width="2" stroke-dasharray="5 4"/></svg>' },
  { name: 'Octagon Frame', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><polygon points="60,5 140,5 195,60 195,140 140,195 60,195 5,140 5,60" fill="none" stroke="#0ea5e9" stroke-width="3"/></svg>' },
  { name: 'Leaf Corners', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="8" y="8" width="184" height="184" rx="10" fill="none" stroke="#15803d" stroke-width="2"/><path d="M12 32c18 0 18-18 36-18-2 20-14 32-36 18zM188 32c-18 0-18-18-36-18 2 20 14 32 36 18zM12 168c18 0 18 18 36 18-2-20-14-32-36-18zM188 168c-18 0-18 18-36 18 2-20 14-32 36-18z" fill="#22c55e"/></svg>' },
  { name: 'Classic Oval', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><ellipse cx="100" cy="100" rx="92" ry="74" fill="none" stroke="#7c3aed" stroke-width="3"/><ellipse cx="100" cy="100" rx="80" ry="62" fill="none" stroke="#a78bfa" stroke-width="1.5"/></svg>' },
  { name: 'Shine Border', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="6" y="6" width="188" height="188" rx="14" fill="none" stroke="#334155" stroke-width="3"/><path d="M22 22h92M22 34h70M178 178h-92M178 166h-70" stroke="#e2e8f0" stroke-width="2" opacity="0.9"/></svg>' },
];

const FRAME_ACCENT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#111827', '#475569', '#9ca3af',
];

const FRAME_LIBRARY_EXTRA: FrameLibraryItem[] = FRAME_ACCENT_COLORS.flatMap((color, idx) => {
  const slot = idx + 1;
  return [
    {
      name: `Classic Tint ${slot}`,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="6" y="6" width="188" height="188" rx="14" fill="none" stroke="${color}" stroke-width="4"/><rect x="16" y="16" width="168" height="168" rx="10" fill="none" stroke="${color}" stroke-opacity="0.5" stroke-width="2"/></svg>`,
    },
    {
      name: `Corner Glow ${slot}`,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="6" y="6" width="188" height="188" rx="18" fill="none" stroke="${color}" stroke-width="3"/><circle cx="22" cy="22" r="7" fill="${color}" fill-opacity="0.9"/><circle cx="178" cy="22" r="7" fill="${color}" fill-opacity="0.9"/><circle cx="22" cy="178" r="7" fill="${color}" fill-opacity="0.9"/><circle cx="178" cy="178" r="7" fill="${color}" fill-opacity="0.9"/></svg>`,
    },
  ];
});

const FRAME_LIBRARY: FrameLibraryItem[] = [...PHOTO_FRAME_LIBRARY, ...FRAME_LIBRARY_BASE, ...FRAME_LIBRARY_EXTRA];

const SHAPE_LIBRARY_BASE: ShapeLibraryItem[] = [
  { name: 'Rectangle', kind: 'native', shapeType: 'rect', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect x="12" y="20" width="96" height="80" rx="10" fill="#3b82f6"/></svg>' },
  { name: 'Circle', kind: 'native', shapeType: 'circle', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="40" fill="#10b981"/></svg>' },
  { name: 'Line', kind: 'native', shapeType: 'line', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><line x1="16" y1="60" x2="104" y2="60" stroke="#6b7280" stroke-width="8" stroke-linecap="round"/></svg>' },
  { name: 'Arrow', kind: 'native', shapeType: 'arrow', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><line x1="16" y1="60" x2="92" y2="60" stroke="#6b7280" stroke-width="8" stroke-linecap="round"/><polygon points="92,40 112,60 92,80" fill="#6b7280"/></svg>' },
  { name: 'Rounded Box', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect x="14" y="14" width="92" height="92" rx="22" fill="#6366f1"/></svg>' },
  { name: 'Triangle', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><polygon points="60,10 110,104 10,104" fill="#0ea5e9"/></svg>' },
  { name: 'Diamond', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><polygon points="60,8 112,60 60,112 8,60" fill="#8b5cf6"/></svg>' },
  { name: 'Pentagon', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><polygon points="60,8 110,45 92,108 28,108 10,45" fill="#ec4899"/></svg>' },
  { name: 'Hexagon', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><polygon points="60,8 104,34 104,86 60,112 16,86 16,34" fill="#14b8a6"/></svg>' },
  { name: 'Octagon', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><polygon points="40,8 80,8 112,40 112,80 80,112 40,112 8,80 8,40" fill="#f97316"/></svg>' },
  { name: 'Star', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><polygon points="60,8 74,44 112,44 82,66 94,104 60,80 26,104 38,66 8,44 46,44" fill="#f59e0b"/></svg>' },
  { name: 'Heart', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><path d="M60 104C33 84 16 69 16 47a22 22 0 0 1 40-13 22 22 0 0 1 40 13c0 22-17 37-36 57z" fill="#ef4444"/></svg>' },
  { name: 'Cloud', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><path d="M31 90h58a19 19 0 0 0 0-38 27 27 0 0 0-52-7 19 19 0 0 0-6 45z" fill="#60a5fa"/></svg>' },
  { name: 'Speech Bubble', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><path d="M16 24h88v56H48l-20 16v-16H16z" fill="#22c55e"/></svg>' },
  { name: 'Ribbon', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><path d="M20 20h80v56H72l-12 16-12-16H20z" fill="#a855f7"/></svg>' },
  { name: 'Badge', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="52" r="34" fill="#06b6d4"/><polygon points="43,82 43,112 60,98 77,112 77,82" fill="#0891b2"/></svg>' },
  { name: 'Parallelogram', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><polygon points="28,20 108,20 92,100 12,100" fill="#84cc16"/></svg>' },
  { name: 'Trapezoid', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><polygon points="30,20 90,20 108,100 12,100" fill="#eab308"/></svg>' },
  { name: 'Lightning', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><polygon points="66,10 36,64 60,64 50,110 88,52 64,52" fill="#facc15"/></svg>' },
  { name: 'Check Mark', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><path d="M16 64l24 24 64-64" fill="none" stroke="#22c55e" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
];

const SHAPE_STYLED_3D: ShapeLibraryItem[] = [
  { name: '3D Cube Blue', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#93c5fd"/><stop offset="100%" stop-color="#2563eb"/></linearGradient><linearGradient id="g2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient></defs><polygon points="60,8 102,30 60,52 18,30" fill="url(#g1)"/><polygon points="18,30 60,52 60,98 18,76" fill="#1e40af"/><polygon points="102,30 60,52 60,98 102,76" fill="url(#g2)"/></svg>' },
  { name: '3D Sphere Purple', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><radialGradient id="s1" cx="32%" cy="28%" r="62%"><stop offset="0%" stop-color="#f5d0fe"/><stop offset="55%" stop-color="#d946ef"/><stop offset="100%" stop-color="#7e22ce"/></radialGradient></defs><circle cx="60" cy="60" r="44" fill="url(#s1)"/><ellipse cx="44" cy="42" rx="14" ry="9" fill="#ffffff" opacity="0.35"/></svg>' },
  { name: '3D Cylinder Emerald', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><ellipse cx="60" cy="28" rx="34" ry="12" fill="#6ee7b7"/><rect x="26" y="28" width="68" height="58" fill="#10b981"/><ellipse cx="60" cy="86" rx="34" ry="12" fill="#047857"/></svg>' },
  { name: 'Metallic Star Gold', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="m1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fef3c7"/><stop offset="50%" stop-color="#d4af37"/><stop offset="100%" stop-color="#a16207"/></linearGradient></defs><polygon points="60,10 74,44 112,44 82,66 94,104 60,82 26,104 38,66 8,44 46,44" fill="url(#m1)" stroke="#92400e" stroke-width="3"/></svg>' },
  { name: 'Metallic Shield Silver', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="m2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="45%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/></linearGradient></defs><path d="M60 10 96 24v28c0 30-18 48-36 58C42 100 24 82 24 52V24Z" fill="url(#m2)" stroke="#475569" stroke-width="3"/></svg>' },
  { name: 'Glossy Subscribe Button', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="gsub" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fb7185"/><stop offset="100%" stop-color="#be123c"/></linearGradient></defs><rect x="12" y="34" width="96" height="52" rx="26" fill="url(#gsub)"/><path d="M26 44h68" stroke="#fff" stroke-opacity="0.35" stroke-width="6"/><text x="60" y="67" text-anchor="middle" fill="#fff" font-size="12" font-family="Inter, Arial" font-weight="700">SUBSCRIBE</text></svg>' },
  { name: 'Glossy Click Badge', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><radialGradient id="gclick" cx="30%" cy="30%" r="70%"><stop offset="0%" stop-color="#93c5fd"/><stop offset="100%" stop-color="#1d4ed8"/></radialGradient></defs><circle cx="60" cy="60" r="42" fill="url(#gclick)"/><circle cx="60" cy="60" r="30" fill="none" stroke="#dbeafe" stroke-width="3" opacity="0.7"/><text x="60" y="66" text-anchor="middle" fill="#fff" font-size="14" font-family="Inter, Arial" font-weight="700">CLICK</text></svg>' },
  { name: 'Gradient Sale Tag', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="sale" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f97316"/><stop offset="100%" stop-color="#ef4444"/></linearGradient></defs><path d="M14 34h56l36 36-36 36H14z" fill="url(#sale)"/><circle cx="38" cy="52" r="6" fill="#fff"/><text x="55" y="77" text-anchor="middle" fill="#fff" font-size="14" font-family="Inter, Arial" font-weight="700">SALE</text></svg>' },
  { name: 'Neon Play Button', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect x="14" y="28" width="92" height="64" rx="16" fill="#0f172a" stroke="#22d3ee" stroke-width="3"/><polygon points="52,45 82,60 52,75" fill="#22d3ee"/><path d="M24 38h72" stroke="#22d3ee" stroke-opacity="0.3"/></svg>' },
  { name: 'Glass Card', kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect x="16" y="22" width="88" height="76" rx="14" fill="#e2e8f0" fill-opacity="0.55" stroke="#ffffff" stroke-width="2"/><path d="M20 36h80" stroke="#ffffff" stroke-opacity="0.7" stroke-width="3"/><circle cx="36" cy="70" r="10" fill="#93c5fd" fill-opacity="0.8"/><rect x="52" y="62" width="40" height="16" rx="8" fill="#ffffff" fill-opacity="0.75"/></svg>' },
];

const SHAPE_LIBRARY_LIMIT = 500;
const BASE_SHAPE_NAMES = new Set(SHAPE_LIBRARY_BASE.map((shape) => shape.name.toLowerCase()));
const SCENE_SHAPE_LIBRARY: ShapeLibraryItem[] = SCENE_SHAPES
  .filter((shape) => !BASE_SHAPE_NAMES.has(shape.name.toLowerCase()))
  .map((shape) => ({
    name: shape.name,
    kind: 'svg' as const,
    svg: shape.svg,
  }));

const SHAPE_LIBRARY: ShapeLibraryItem[] = [
  ...SHAPE_LIBRARY_BASE,
  ...SHAPE_STYLED_3D,
  ...SCENE_SHAPE_LIBRARY,
]
  .filter((item, idx, arr) => arr.findIndex((other) => other.name.toLowerCase() === item.name.toLowerCase()) === idx)
  .slice(0, SHAPE_LIBRARY_LIMIT);

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
  const initialDraftId = searchParams.get('draftId');
  const contentPlanPostId = searchParams.get('contentPlanPostId');
  const [platform, setPlatform] = useState(searchParams.get('platform') || 'instagram');
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
  const [showAiImageModal, setShowAiImageModal] = useState(false);
  const [aiImageQuota, setAiImageQuota] = useState<{ used: number; limit: number; tier: string } | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateCategory, setSaveTemplateCategory] = useState('Business & Corporate');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [collabUsers, setCollabUsers] = useState<CollabUser[]>([]);
  const [collabStatus, setCollabStatus] = useState<'idle' | 'connecting' | 'connected' | 'blocked' | 'error'>('idle');
  const [collabEnabled, setCollabEnabled] = useState(false);

  // New state for advanced features
  const [openPanel, setOpenPanel] = useState<SidebarPanel | null>(null);
  const [assetTab, setAssetTab] = useState<'shapes' | 'frames'>('shapes');
  const [showIconLibrary, setShowIconLibrary] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [activeObjType, setActiveObjType] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [layerRefresh, setLayerRefresh] = useState(0);
  const [bgRemovalLoading, setBgRemovalLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [sendingToCompose, setSendingToCompose] = useState(false);
  const [textColor, setTextColor] = useState('#111827');
  const [textSize, setTextSize] = useState(32);
  const [textWeight, setTextWeight] = useState<'normal' | 'bold'>('normal');
  const [textItalic, setTextItalic] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [canvasScale, setCanvasScale] = useState(SCALE_FACTOR);
  const [customBgColor, setCustomBgColor] = useState('#ffffff');
  const [customGradientA, setCustomGradientA] = useState('#2563eb');
  const [customGradientB, setCustomGradientB] = useState('#8b5cf6');
  const [customGradientC, setCustomGradientC] = useState('#ec4899');
  const [shapeFillColor, setShapeFillColor] = useState('#2563eb');
  const [shapeStrokeColor, setShapeStrokeColor] = useState('#111827');

  const size = getCanvasSize(platform, postType);
  const {
    canvas, canvasReady, addText, addShape, addPhotoFrame, addImage, placeImage, deleteSelected,
    resizeCanvas, setBackground, exportImage, loadJSON, toJSON,
    undo, redo, canUndo, canRedo, bringForward, sendBackward,
    copySelected, pasteClipboard, groupSelected, ungroupSelected,
    applyImageFilter, clearImageFilters, getObjects, getActiveType,
    selectObject, bringToFront, sendToBack, toggleObjectVisibility,
    toggleObjectLock, addSvgString, cropActiveImageToAspect,
    resetActiveImageCrop, rotateSelected, commitHistory,
  } = useCanvas('editor-canvas', size);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedQueryTemplateIdRef = useRef<string | null>(null);
  const loadedDraftIdRef = useRef<string | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
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
      const selectedType = getActiveType();
      const active = c.getActiveObject() as any;
      setActiveObjType(selectedType);
      setLayerRefresh((n) => n + 1);
      // Reset filter sliders when selecting a new image
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
      if (selectedType === 'text' && active) {
        if (typeof active.fill === 'string' && active.fill) setTextColor(active.fill);
        if (Number.isFinite(active.fontSize)) setTextSize(Math.max(1, Math.round(active.fontSize)));
        if (typeof active.fontFamily === 'string' && active.fontFamily.trim()) setSelectedFont(active.fontFamily);
        const weight = active.fontWeight;
        setTextWeight(weight === 'bold' || Number(weight) >= 600 ? 'bold' : 'normal');
        setTextItalic((active.fontStyle || '').toString().toLowerCase() === 'italic');
        if (active.textAlign === 'left' || active.textAlign === 'center' || active.textAlign === 'right') {
          setTextAlign(active.textAlign);
        }
      }
      if ((selectedType === 'shape' || selectedType === 'group' || selectedType === 'selection') && active) {
        const readShapeColors = (obj: any): { fill?: string; stroke?: string } => {
          if (!obj) return {};
          const type = (obj.type || '').toString().toLowerCase();
          if ((type === 'group' || type === 'activeselection') && typeof obj.getObjects === 'function') {
            const children = obj.getObjects();
            for (const child of children) {
              const childColors = readShapeColors(child);
              if (childColors.fill || childColors.stroke) return childColors;
            }
            return {};
          }
          return {
            fill: typeof obj.fill === 'string' && obj.fill !== 'none' ? obj.fill : undefined,
            stroke: typeof obj.stroke === 'string' && obj.stroke !== 'none' ? obj.stroke : undefined,
          };
        };
        const colors = readShapeColors(active);
        if (colors.fill) setShapeFillColor(colors.fill);
        if (colors.stroke) setShapeStrokeColor(colors.stroke);
      }
    };
    c.on('selection:created', onSelection);
    c.on('selection:updated', onSelection);
    c.on('selection:cleared', () => {
      setActiveObjType(null);
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
      const key = e.key.toLowerCase();
      const active = canvas.current?.getActiveObject() as any;
      if (active?.isEditing) return;
      if (e.repeat && ctrl && ['z', 'y'].includes(key)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (ctrl && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (ctrl && key === 'y') {
        e.preventDefault();
        redo();
      } else if (ctrl && key === 'c') {
        e.preventDefault();
        copySelected();
      } else if (ctrl && key === 'v') {
        e.preventDefault();
        pasteClipboard();
      } else if (ctrl && key === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupSelected();
      } else if (ctrl && key === 'g' && e.shiftKey) {
        e.preventDefault();
        ungroupSelected();
      } else if (ctrl && key === 'd') {
        e.preventDefault();
        copySelected();
        setTimeout(() => pasteClipboard(), 50);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canvas, deleteSelected, undo, redo, copySelected, pasteClipboard, groupSelected, ungroupSelected]);

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

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      const availableWidth = Math.max(viewport.clientWidth - 24, 1);
      const availableHeight = Math.max(viewport.clientHeight - 24, 1);
      const next = Math.min(1, availableWidth / size.width, availableHeight / size.height);
      setCanvasScale(Math.max(0.2, next));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScale) : null;
    observer?.observe(viewport);
    return () => {
      window.removeEventListener('resize', updateScale);
      observer?.disconnect();
    };
  }, [size.height, size.width]);

  const applyTextStyles = useCallback((styles: Record<string, unknown>) => {
    const c = canvas.current;
    if (!c) return;
    const active = c.getActiveObject() as any;
    if (!active) return;

    const applyToObject = (obj: any) => {
      if (!obj) return false;
      const type = obj.type;
      if (type !== 'i-text' && type !== 'text' && type !== 'textbox') return false;
      obj.set(styles);
      obj.setCoords?.();
      return true;
    };

    let changed = false;
    if (active.type === 'activeSelection' && typeof active.forEachObject === 'function') {
      active.forEachObject((obj: any) => {
        if (applyToObject(obj)) changed = true;
      });
    } else {
      changed = applyToObject(active);
    }

    if (!changed) return;
    c.requestRenderAll();
    commitHistory();
    setLayerRefresh((n) => n + 1);
  }, [canvas, commitHistory]);

  function handleFontFamilyChange(font: string) {
    setSelectedFont(font);
    applyTextStyles({ fontFamily: font });
  }

  function handleTextSizeChange(next: number) {
    const value = Math.max(1, Math.min(400, Math.round(next || 1)));
    setTextSize(value);
    applyTextStyles({ fontSize: value });
  }

  function handleTextColorChange(color: string) {
    setTextColor(color);
    applyTextStyles({ fill: color });
  }

  function handleTextWeightChange(weight: 'normal' | 'bold') {
    setTextWeight(weight);
    applyTextStyles({ fontWeight: weight });
  }

  function handleTextItalicChange(value: boolean) {
    setTextItalic(value);
    applyTextStyles({ fontStyle: value ? 'italic' : 'normal' });
  }

  function handleTextAlignChange(align: 'left' | 'center' | 'right') {
    setTextAlign(align);
    applyTextStyles({ textAlign: align });
  }

  const applyShapeStyles = useCallback((styles: { fill?: string; stroke?: string }) => {
    const c = canvas.current;
    if (!c) return;
    const active = c.getActiveObject() as any;
    if (!active) return;

    const applyToObject = (obj: any): boolean => {
      if (!obj) return false;
      const type = (obj.type || '').toString().toLowerCase();

      if ((type === 'group' || type === 'activeselection') && typeof obj.getObjects === 'function') {
        let changedInGroup = false;
        obj.getObjects().forEach((child: any) => {
          if (applyToObject(child)) changedInGroup = true;
        });
        obj.setCoords?.();
        return changedInGroup;
      }

      let changed = false;
      const canFill = typeof obj.fill === 'string' && obj.fill !== 'none';
      const canStroke = typeof obj.stroke === 'string' || obj.stroke === undefined || obj.stroke === null;
      const fillableTypes = ['rect', 'circle', 'triangle', 'ellipse', 'polygon', 'path'];
      const strokeableTypes = ['line', 'polyline', 'path', 'polygon', 'rect', 'circle', 'triangle', 'ellipse'];

      if (styles.fill && (canFill || fillableTypes.includes(type))) {
        obj.set('fill', styles.fill);
        changed = true;
      }

      if (styles.stroke && (canStroke || strokeableTypes.includes(type))) {
        obj.set('stroke', styles.stroke);
        if (!obj.strokeWidth && type !== 'line' && type !== 'polyline') {
          obj.set('strokeWidth', 2);
        }
        changed = true;
      }

      obj.setCoords?.();
      return changed;
    };

    if (!applyToObject(active)) return;
    c.requestRenderAll();
    commitHistory();
    setLayerRefresh((n) => n + 1);
  }, [canvas, commitHistory]);

  function handleShapeFillChange(color: string) {
    setShapeFillColor(color);
    applyShapeStyles({ fill: color });
  }

  function handleShapeStrokeChange(color: string) {
    setShapeStrokeColor(color);
    applyShapeStyles({ stroke: color });
  }

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
    reader.onload = () => placeImage(reader.result as string);
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
    const bounds = canvasAreaRef.current?.getBoundingClientRect();
    const dropPoint = bounds
      ? {
        x: (e.clientX - bounds.left) / canvasScale,
        y: (e.clientY - bounds.top) / canvasScale,
      }
      : undefined;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => placeImage(reader.result as string, dropPoint);
        reader.readAsDataURL(file);
      }
    }
  }, [canvasScale, placeImage]);

  function handleExport(format: 'png' | 'jpeg' | 'pdf') {
    if (format === 'pdf') {
      handleExportPDF();
      return;
    }
    const dataUrl = exportImage(format);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `smmtai-${platform}-${postType}.${format}`;
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
    pdf.save(`smmtai-${platform}-${postType}.pdf`);
  }

  async function pushDesignToCompose() {
    const dataUrl = exportImage('png');
    if (!dataUrl) {
      if (contentPlanPostId) navigate('/planner');
      else if (initialDraftId) navigate(`/compose?draftId=${initialDraftId}`);
      else navigate('/compose');
      return;
    }

    setSendingToCompose(true);
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `smmtai-${platform}-${postType}.png`, { type: 'image/png' });
      const blobUrl = URL.createObjectURL(blob);
      const json = toJSON();
      
      if (contentPlanPostId) {
        // Upload media specifically for Content Planner
        const fd = new FormData();
        fd.append('media', file);
        const updatedPost = await api.contentPlanner.uploadMedia(contentPlanPostId, fd);
        await api.contentPlanner.saveDesign(contentPlanPostId, { 
          mediaUrl: updatedPost.mediaUrls?.[0] || blobUrl, 
          designData: json 
        });
        navigate(`/planner?planId=${updatedPost.planId}`);
        return;
      }

      // Normal Compose Flow
      const upload = await api.posts.uploadMedia(file);
      saveComposeSeed({
        source: 'editor',
        media: [upload.data],
      });
      if (initialDraftId) navigate(`/compose?draftId=${initialDraftId}`);
      else navigate('/compose');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send design');
    } finally {
      setSendingToCompose(false);
    }
  }

  async function handleSendToCompose() {
    await pushDesignToCompose();
  }

  async function handleScheduleFromEditor() {
    await pushDesignToCompose();
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

  useEffect(() => {
    if (!canvasReady || !initialDraftId) return;
    if (loadedDraftIdRef.current === initialDraftId) return;
    loadedDraftIdRef.current = initialDraftId;

    api.posts.get(initialDraftId)
      .then((res) => {
        const draft = res.data;
        if (draft && draft.designData) {
          try {
            let dataObj = typeof draft.designData === 'string' ? JSON.parse(draft.designData) : draft.designData;
            if (dataObj.width && dataObj.height) {
              resizeCanvas({ width: dataObj.width, height: dataObj.height, label: 'Custom AI Draft' });
            }
            const jsonStr = typeof draft.designData === 'string' 
              ? draft.designData 
              : JSON.stringify(draft.designData);
            loadJSON(jsonStr);
          } catch (err) {
            console.error('Failed to parse draft design:', err);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load draft design:', err);
      });
  }, [canvasReady, initialDraftId, loadJSON, resizeCanvas]);

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

  async function handleAiImageGenerate(prompt: string, style: string) {
    if (!prompt.trim()) return;
    setAiImageLoading(true);
    try {
      const res = await api.ai.generateImage({ prompt, style });
      if (res.data?.imageUrl) {
        placeImage(res.data.imageUrl);
        if (res.data.quota) setAiImageQuota(res.data.quota);
        setShowAiImageModal(false);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'AI Image generation failed';
      if (msg.includes('Upgrade to access') || msg.includes('limit reached')) {
        toast.error('AI image generation requires a Pro plan or higher. Upgrade to access this feature.');
      } else if (msg.includes('Monthly quota exceeded')) {
        toast.error(msg);
      } else {
        toast.error(`Generation failed: ${msg}`);
      }
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

      // Dynamically load @imgly/background-removal via CDN to bypass npm issues
      // @ts-ignore
      const imgly = await import('https://unpkg.com/@imgly/background-removal@1.4.5/dist/imgly-background-removal.esm.js');
      
      const resultBlob = await imgly.default(dataUrl, {
        output: { format: 'image/png', quality: 1.0 }
      });
      
      const url = URL.createObjectURL(resultBlob);
      addImage(url);
      c.remove(obj);
      c.requestRenderAll();
      toast.success('Background removed successfully!');
    } catch (err: any) {
      const errMsg = err?.message || 'Background removal failed';
      toast.error(`Remove background failed: ${errMsg}. Make sure you have an image selected.`);
      console.error(err);
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

  const togglePanel = useCallback((panel: SidebarPanel) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  }, []);

  const openPanelOnly = useCallback((panel: SidebarPanel) => {
    setOpenPanel(panel);
  }, []);

  const openAssetTab = useCallback((panel: 'shapes' | 'frames') => {
    setAssetTab(panel);
    setOpenPanel('assets');
  }, []);

  function handleShapeLibraryInsert(item: ShapeLibraryItem) {
    if (item.kind === 'native' && item.shapeType) {
      addShape(item.shapeType);
      return;
    }
    addSvgString(item.svg);
  }

  function handleFrameLibraryInsert(frame: FrameLibraryItem) {
    if (frame.kind === 'photo' && frame.photoType) {
      addPhotoFrame(frame.photoType);
      return;
    }
    addSvgString(frame.svg);
  }

  const objects = getObjects();
  const isTextSelected = activeObjType === 'text';
  const isShapeSelected = activeObjType === 'shape' || activeObjType === 'group' || activeObjType === 'selection';
  const displayW = Math.round(size.width * canvasScale);
  const displayH = Math.round(size.height * canvasScale);

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
    <div className="space-y-4 min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Design Editor</h1>
          <p className="text-sm text-neutral-500 mt-1">{size.label} — {size.width}×{size.height}px</p>
        </div>
        <div className="flex gap-2 items-center overflow-x-auto whitespace-nowrap py-1 justify-start max-w-full lg:flex-wrap lg:justify-end lg:overflow-x-visible" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAiImageModal(true)}
            loading={aiImageLoading}
          >
            <Sparkles className="w-4 h-4" /> AI Image
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(true)}>
            <Save className="w-4 h-4" /> Save Template
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowTemplates(!showTemplates)}>
            <LayoutTemplate className="w-4 h-4" /> Templates
          </Button>
          {contentPlanPostId ? (
            <Button variant="primary" size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={handleSendToCompose} loading={sendingToCompose}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Save to Planner
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={handleSendToCompose} loading={sendingToCompose}>
                <Send className="w-4 h-4" /> Send to Compose
              </Button>
              <Button variant="secondary" size="sm" onClick={handleScheduleFromEditor} loading={sendingToCompose}>
                <Clock className="w-4 h-4" /> Schedule Post
              </Button>
            </>
          )}
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

      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start h-auto lg:h-[calc(100vh-10rem)]">
        {/* Left toolbar */}
        <Card className="p-2 lg:p-3 space-y-2 w-full lg:w-14 h-14 lg:h-full overflow-x-auto lg:overflow-y-auto flex flex-row lg:flex-col items-center shrink-0 gap-2 lg:gap-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <TBtn onClick={() => openPanelOnly('text')} title="Text Styles">
            <Type className={`w-5 h-5 ${openPanel === 'text' ? 'text-brand-blue' : 'text-neutral-600'}`} />
          </TBtn>
          <TBtn onClick={() => openPanelOnly('background')} title="Background">
            <Palette className={`w-5 h-5 ${openPanel === 'background' ? 'text-brand-blue' : 'text-neutral-600'}`} />
          </TBtn>
          <TBtn onClick={() => openAssetTab('shapes')} title="Shape Library">
            <Square className={`w-5 h-5 ${openPanel === 'assets' && assetTab === 'shapes' ? 'text-brand-blue' : 'text-neutral-600'}`} />
          </TBtn>
          <TBtn onClick={() => openAssetTab('frames')} title="Frame Library">
            <Frame className={`w-5 h-5 ${openPanel === 'assets' && assetTab === 'frames' ? 'text-brand-blue' : 'text-neutral-600'}`} />
          </TBtn>
          <TBtn onClick={() => fileInputRef.current?.click()} title="Upload Image"><ImageIcon className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => setShowImageSearch(!showImageSearch)} title="Search Images"><Search className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => setShowIconLibrary(true)} title="Icon Library"><Smile className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={() => setShowAiImageModal(true)} title="AI Generate Image">
            <Sparkles className="w-5 h-5 text-neutral-600" />
          </TBtn>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

          <div className="hidden lg:block w-8 h-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <div className="block lg:hidden w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />
          <TBtn onClick={copySelected} title="Copy (Ctrl+C)"><Copy className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={pasteClipboard} title="Paste (Ctrl+V)"><ClipboardPaste className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={groupSelected} title="Group (Ctrl+G)"><Group className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={ungroupSelected} title="Ungroup (Ctrl+Shift+G)"><Ungroup className="w-5 h-5 text-neutral-600" /></TBtn>

          <div className="hidden lg:block w-8 h-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <div className="block lg:hidden w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />
          <TBtn onClick={undo} title="Undo (Ctrl+Z)" disabled={!canUndo}><Undo2 className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={redo} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo}><Redo2 className="w-5 h-5 text-neutral-600" /></TBtn>

          <div className="hidden lg:block w-8 h-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <div className="block lg:hidden w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />
          <TBtn onClick={bringToFront} title="Bring to Front"><ChevronsUp className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={bringForward} title="Bring Forward"><ArrowUp className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={sendBackward} title="Send Backward"><ArrowDown className="w-5 h-5 text-neutral-600" /></TBtn>
          <TBtn onClick={sendToBack} title="Send to Back"><ChevronsDown className="w-5 h-5 text-neutral-600" /></TBtn>

          <div className="hidden lg:block w-8 h-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <div className="block lg:hidden w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />
          <TBtn onClick={() => togglePanel('layers')} title="Layers Panel">
            <Layers className={`w-5 h-5 ${openPanel === 'layers' ? 'text-brand-blue' : 'text-neutral-600'}`} />
          </TBtn>
          {activeObjType === 'image' && (
            <>
              <TBtn onClick={() => togglePanel('crop')} title="Crop Tools">
                <Scissors className={`w-5 h-5 ${openPanel === 'crop' ? 'text-brand-blue' : 'text-neutral-600'}`} />
              </TBtn>
              <TBtn onClick={() => rotateSelected(-90)} title="Rotate Left">
                <RotateCcw className="w-5 h-5 text-neutral-600" />
              </TBtn>
              <TBtn onClick={() => rotateSelected(90)} title="Rotate Right">
                <RotateCw className="w-5 h-5 text-neutral-600" />
              </TBtn>
              <TBtn onClick={() => togglePanel('tune')} title="Image Tuning">
                <SunMedium className={`w-5 h-5 ${openPanel === 'tune' ? 'text-brand-blue' : 'text-neutral-600'}`} />
              </TBtn>
              <TBtn onClick={handleBackgroundRemoval} title="Remove Background" disabled={bgRemovalLoading}>
                <Eraser className="w-5 h-5 text-neutral-600" />
              </TBtn>
            </>
          )}

          <div className="hidden lg:block w-8 h-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <div className="block lg:hidden w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />
          <TBtn onClick={deleteSelected} title="Delete (Del)" danger><Trash2 className="w-5 h-5 text-red-500" /></TBtn>
        </Card>

        {/* Canvas with drag-and-drop */}
        <div className="flex-1 min-w-0 h-[420px] sm:h-[500px] lg:h-full">
          <div ref={canvasViewportRef} className="w-full h-full rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3 flex items-center justify-center overflow-auto">
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
                <div className="absolute inset-0 z-50 bg-brand-500/10 border-2 border-brand-500 border-dashed rounded flex items-center justify-center pointer-events-none">
                  <div className="bg-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 text-brand-700 font-medium">
                    <ImageIcon className="w-5 h-5" /> Drop image here
                  </div>
                </div>
              )}
              
              {/* Background Removal Spinner Overlay */}
              {bgRemovalLoading && (
                <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
                  <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                  <p className="text-white text-lg font-bold tracking-wide drop-shadow-md">Isolating Subject...</p>
                  <p className="text-brand-200 text-sm mt-2 flex items-center gap-2 drop-shadow-md bg-black/40 px-3 py-1 rounded-full border border-white/10">
                    <Sparkles className="w-4 h-4" /> Running On-Device AI Model
                  </p>
                </div>
              )}

              <div style={{ transform: `scale(${canvasScale})`, transformOrigin: 'top left' }}>
                <canvas id="editor-canvas" />
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className={`w-full lg:w-72 h-auto lg:h-full space-y-3 lg:space-y-3 overflow-y-auto pr-1 shrink-0 transition-all duration-300 ${openPanel ? 'block' : 'hidden lg:block'}`}>
          {/* Platform & Size */}
          <Card className={`overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${openPanel === 'platform' ? 'block' : 'hidden lg:block'}`}>
            <button
              onClick={() => togglePanel('platform')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <span className="text-xs font-medium text-neutral-700">Platform & Size</span>
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openPanel === 'platform' ? 'rotate-180' : ''}`} />
                {openPanel === 'platform' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenPanel(null);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 block lg:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
            {openPanel === 'platform' && (
              <div className="p-4 pt-0 space-y-4 border-t border-neutral-100">
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
                    onChange={(e) => handleFontFamilyChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm"
                  >
                    {GOOGLE_FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </Card>

          {/* Background */}
          <Card className={`overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${openPanel === 'background' ? 'block' : 'hidden lg:block'}`}>
            <button
              onClick={() => togglePanel('background')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <span className="text-xs font-medium text-neutral-700">Background</span>
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openPanel === 'background' ? 'rotate-180' : ''}`} />
                {openPanel === 'background' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenPanel(null);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 block lg:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
            {openPanel === 'background' && (
              <div className="p-4 pt-0 space-y-3 border-t border-neutral-100">
                <div className="flex gap-1.5 flex-wrap max-h-[8.5rem] overflow-y-auto pr-1">
                  {BACKGROUND_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleBgChange(c)}
                      className={`w-7 h-7 rounded-lg border-2 transition-all ${bgColor === c ? 'border-brand-blue scale-110' : 'border-neutral-200'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customBgColor}
                    onChange={(e) => setCustomBgColor(e.target.value)}
                    className="w-9 h-8 px-1 py-1 border border-neutral-200 rounded-lg bg-white"
                    title="Custom background color"
                  />
                  <Button size="sm" variant="secondary" className="text-xs flex-1" onClick={() => handleBgChange(customBgColor)}>
                    Apply Custom Color
                  </Button>
                </div>
                <label className="block text-xs font-medium text-neutral-500 mt-2">Gradients</label>
                <div className="flex gap-1.5 flex-wrap max-h-[8.5rem] overflow-y-auto pr-1">
                  {GRADIENT_PRESETS.map((g) => {
                    const colors = g.value.match(/#[0-9A-Fa-f]{6}/g) || [];
                    return (
                      <button
                        key={g.label}
                        onClick={() => handleBgChange(g.value)}
                        title={g.label}
                        className="w-7 h-7 rounded-lg border-2 border-neutral-200 transition-all hover:scale-110"
                        style={{ background: colors.length ? `linear-gradient(135deg, ${colors.join(', ')})` : '#e5e7eb' }}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="color"
                    value={customGradientA}
                    onChange={(e) => setCustomGradientA(e.target.value)}
                    className="w-full h-8 px-1 py-1 border border-neutral-200 rounded-lg bg-white"
                    title="Gradient color 1"
                  />
                  <input
                    type="color"
                    value={customGradientB}
                    onChange={(e) => setCustomGradientB(e.target.value)}
                    className="w-full h-8 px-1 py-1 border border-neutral-200 rounded-lg bg-white"
                    title="Gradient color 2"
                  />
                  <input
                    type="color"
                    value={customGradientC}
                    onChange={(e) => setCustomGradientC(e.target.value)}
                    className="w-full h-8 px-1 py-1 border border-neutral-200 rounded-lg bg-white"
                    title="Gradient color 3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => handleBgChange(`linear(${customGradientA}, ${customGradientB})`)}
                  >
                    Apply 2-Color
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => handleBgChange(`linear(${customGradientA}, ${customGradientB}, ${customGradientC})`)}
                  >
                    Apply 3-Color
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Assets */}
          <Card className={`overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${openPanel === 'assets' ? 'block' : 'hidden lg:block'}`}>
            <button
              onClick={() => togglePanel('assets')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <span className="text-xs font-medium text-neutral-700">Shapes & Frames</span>
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openPanel === 'assets' ? 'rotate-180' : ''}`} />
                {openPanel === 'assets' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenPanel(null);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 block lg:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
            {openPanel === 'assets' && (
              <div className="p-4 pt-0 space-y-3 border-t border-neutral-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAssetTab('shapes')}
                    className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border ${assetTab === 'shapes' ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}
                    style={assetTab === 'shapes' ? { backgroundColor: '#111827', color: '#ffffff', borderColor: '#111827' } : undefined}
                  >
                    Shapes ({SHAPE_LIBRARY.length})
                  </button>
                  <button
                    onClick={() => setAssetTab('frames')}
                    className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border ${assetTab === 'frames' ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}
                    style={assetTab === 'frames' ? { backgroundColor: '#111827', color: '#ffffff', borderColor: '#111827' } : undefined}
                  >
                    Frames ({FRAME_LIBRARY.length})
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto pr-1">
                  {assetTab === 'shapes' ? (
                    <div className="grid grid-cols-2 gap-2">
                      {SHAPE_LIBRARY.map((item) => (
                        <button
                          key={item.name}
                          onClick={() => handleShapeLibraryInsert(item)}
                          className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-neutral-200 hover:border-brand-blue hover:shadow-sm transition-all"
                        >
                          <div
                            className="w-16 h-16 flex items-center justify-center bg-neutral-50 rounded-md"
                            dangerouslySetInnerHTML={{ __html: item.svg.replace(/width="120"/g, 'width="64"').replace(/height="120"/g, 'height="64"') }}
                          />
                          <span className="text-[10px] text-neutral-600 leading-tight text-center">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-neutral-500 px-1">Tip: drop or upload an image while selecting/dropping on a Photo Frame to auto-fit.</p>
                      <div className="grid grid-cols-2 gap-2">
                        {FRAME_LIBRARY.map((frame) => (
                          <button
                            key={frame.name}
                            onClick={() => handleFrameLibraryInsert(frame)}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-neutral-200 hover:border-brand-blue hover:shadow-sm transition-all"
                          >
                            <div
                              className="w-16 h-16 flex items-center justify-center bg-neutral-50 rounded-md"
                              dangerouslySetInnerHTML={{ __html: frame.svg.replace(/width="200"/g, 'width="64"').replace(/height="200"/g, 'height="64"') }}
                            />
                            <span className="text-[10px] text-neutral-600 leading-tight text-center">{frame.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Quick Add */}
          <Card className={`overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${openPanel === 'quick' ? 'block' : 'hidden lg:block'}`}>
            <button
              onClick={() => togglePanel('quick')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <span className="text-xs font-medium text-neutral-700">Quick Add</span>
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openPanel === 'quick' ? 'rotate-180' : ''}`} />
                {openPanel === 'quick' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenPanel(null);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 block lg:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
            {openPanel === 'quick' && (
              <div className="p-4 pt-0 space-y-2 border-t border-neutral-100">
                <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Heading', { fontSize: 48, fontWeight: 'bold', fontFamily: selectedFont } as any)}>
                  + Heading
                </Button>
                <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Body text', { fontSize: 24, fontFamily: selectedFont } as any)}>
                  + Body Text
                </Button>
                <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => addText('Caption', { fontSize: 18, fill: '#6B7280', fontFamily: selectedFont } as any)}>
                  + Caption
                </Button>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <Button size="sm" variant="secondary" className="text-xs" onClick={() => addShape('rect')}>
                    + Rectangle
                  </Button>
                  <Button size="sm" variant="secondary" className="text-xs" onClick={() => addShape('circle')}>
                    + Circle
                  </Button>
                  <Button size="sm" variant="secondary" className="text-xs" onClick={() => handleFrameLibraryInsert(FRAME_LIBRARY[0])}>
                    + Picture Frame
                  </Button>
                  <Button size="sm" variant="secondary" className="text-xs" onClick={() => handleFrameLibraryInsert(FRAME_LIBRARY[2])}>
                    + Round Frame
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Text styling */}
          <Card className={`overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${openPanel === 'text' ? 'block' : 'hidden lg:block'}`}>
            <button
              onClick={() => togglePanel('text')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <span className="text-xs font-medium text-neutral-700">Text Styles</span>
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openPanel === 'text' ? 'rotate-180' : ''}`} />
                {openPanel === 'text' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenPanel(null);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 block lg:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
            {openPanel === 'text' && (
              <div className="p-4 pt-0 space-y-3 border-t border-neutral-100">
                {!isTextSelected && <span className="text-[10px] text-neutral-400">Select text to edit</span>}
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Font</label>
                  <select
                    value={selectedFont}
                    onChange={(e) => handleFontFamilyChange(e.target.value)}
                    disabled={!isTextSelected}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs disabled:opacity-50"
                  >
                    {GOOGLE_FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">Size</label>
                    <input
                      type="number"
                      min={1}
                      max={400}
                      value={textSize}
                      disabled={!isTextSelected}
                      onChange={(e) => handleTextSizeChange(parseInt(e.target.value, 10))}
                      className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">Color</label>
                    <input
                      type="color"
                      value={textColor}
                      disabled={!isTextSelected}
                      onChange={(e) => handleTextColorChange(e.target.value)}
                      className="w-full h-8 px-1 py-1 border border-neutral-200 rounded-lg bg-white disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant={textWeight === 'bold' ? 'primary' : 'secondary'}
                    className="text-xs"
                    disabled={!isTextSelected}
                    onClick={() => handleTextWeightChange('bold')}
                  >
                    <Bold className="w-3.5 h-3.5" /> Bold
                  </Button>
                  <Button
                    size="sm"
                    variant={textWeight === 'normal' ? 'primary' : 'secondary'}
                    className="text-xs"
                    disabled={!isTextSelected}
                    onClick={() => handleTextWeightChange('normal')}
                  >
                    Normal
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <Button
                    size="sm"
                    variant={textItalic ? 'primary' : 'secondary'}
                    className="text-xs"
                    disabled={!isTextSelected}
                    onClick={() => handleTextItalicChange(!textItalic)}
                  >
                    <Italic className="w-3.5 h-3.5" /> Italic
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    size="sm"
                    variant={textAlign === 'left' ? 'primary' : 'secondary'}
                    className="text-xs"
                    disabled={!isTextSelected}
                    onClick={() => handleTextAlignChange('left')}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant={textAlign === 'center' ? 'primary' : 'secondary'}
                    className="text-xs"
                    disabled={!isTextSelected}
                    onClick={() => handleTextAlignChange('center')}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant={textAlign === 'right' ? 'primary' : 'secondary'}
                    className="text-xs"
                    disabled={!isTextSelected}
                    onClick={() => handleTextAlignChange('right')}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Shape styling */}
          <Card className={`overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${openPanel === 'shape' ? 'block' : 'hidden lg:block'}`}>
            <button
              onClick={() => togglePanel('shape')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <span className="text-xs font-medium text-neutral-700">Shape Styles</span>
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openPanel === 'shape' ? 'rotate-180' : ''}`} />
                {openPanel === 'shape' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenPanel(null);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 block lg:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
            {openPanel === 'shape' && (
              <div className="p-4 pt-0 space-y-3 border-t border-neutral-100">
                {!isShapeSelected && <span className="text-[10px] text-neutral-400">Select shape/frame to edit</span>}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">Fill</label>
                    <input
                      type="color"
                      value={shapeFillColor}
                      disabled={!isShapeSelected}
                      onChange={(e) => handleShapeFillChange(e.target.value)}
                      className="w-full h-8 px-1 py-1 border border-neutral-200 rounded-lg bg-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">Border</label>
                    <input
                      type="color"
                      value={shapeStrokeColor}
                      disabled={!isShapeSelected}
                      onChange={(e) => handleShapeStrokeChange(e.target.value)}
                      className="w-full h-8 px-1 py-1 border border-neutral-200 rounded-lg bg-white disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Quick Fill Colors</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {SHAPE_COLOR_SWATCHES.map((color) => (
                      <button
                        key={`shape-fill-${color}`}
                        disabled={!isShapeSelected}
                        onClick={() => handleShapeFillChange(color)}
                        className={`w-6 h-6 rounded-md border-2 transition-all disabled:opacity-40 ${shapeFillColor === color ? 'border-brand-blue scale-110' : 'border-neutral-200'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Quick Border Colors</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {SHAPE_COLOR_SWATCHES.map((color) => (
                      <button
                        key={`shape-stroke-${color}`}
                        disabled={!isShapeSelected}
                        onClick={() => handleShapeStrokeChange(color)}
                        className={`w-6 h-6 rounded-md border-2 transition-all disabled:opacity-40 ${shapeStrokeColor === color ? 'border-brand-blue scale-110' : 'border-neutral-200'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Image Crop Tools */}
          <Card className={`overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${openPanel === 'crop' ? 'block' : 'hidden lg:block'}`}>
            <button
              onClick={() => activeObjType === 'image' && togglePanel('crop')}
              disabled={activeObjType !== 'image'}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50 disabled:cursor-not-allowed"
            >
              <span className="text-xs font-medium text-neutral-700">Crop & Rotate</span>
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openPanel === 'crop' ? 'rotate-180' : ''}`} />
                {openPanel === 'crop' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenPanel(null);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 block lg:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
            {openPanel === 'crop' && activeObjType === 'image' && (
              <div className="p-4 pt-0 space-y-3 border-t border-neutral-100">
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
              </div>
            )}
          </Card>

          {/* Image Fine-Tuning */}
          <Card className={`overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${openPanel === 'tune' ? 'block' : 'hidden lg:block'}`}>
            <button
              onClick={() => activeObjType === 'image' && togglePanel('tune')}
              disabled={activeObjType !== 'image'}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50 disabled:cursor-not-allowed"
            >
              <span className="text-xs font-medium text-neutral-700">Image Tuning</span>
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openPanel === 'tune' ? 'rotate-180' : ''}`} />
                {openPanel === 'tune' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenPanel(null);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 block lg:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
            {openPanel === 'tune' && activeObjType === 'image' && (
              <div className="p-4 pt-0 space-y-3 border-t border-neutral-100">
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
              </div>
            )}
          </Card>

          {/* Layer Management Panel */}
          <Card className={`overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${openPanel === 'layers' ? 'block' : 'hidden lg:block'}`}>
            <button
              onClick={() => togglePanel('layers')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <span className="text-xs font-medium text-neutral-700">Layers ({objects.length})</span>
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${openPanel === 'layers' ? 'rotate-180' : ''}`} />
                {openPanel === 'layers' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenPanel(null);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 block lg:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
            {openPanel === 'layers' && (
              <div className="p-4 pt-0 space-y-2 border-t border-neutral-100">
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
              </div>
            )}
          </Card>
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
                    onClick={() => { placeImage(img.url); setShowImageSearch(false); }}
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

      {showAiImageModal && (
        <AIImageModal
          loading={aiImageLoading}
          quota={aiImageQuota}
          onClose={() => setShowAiImageModal(false)}
          onGenerate={(p, s) => handleAiImageGenerate(p, s)}
        />
      )}

    </div>
  );
}

// ── AI Image Generation Modal ──────────────────────────────────────────────────
const AI_STYLES = [
  { value: 'photorealistic', label: '📷 Photorealistic', desc: 'Professional photography look' },
  { value: 'illustration', label: '🎨 Illustration', desc: 'Vibrant digital art style' },
  { value: '3d_render', label: '🧊 3D Render', desc: 'Cinematic 3D rendering' },
  { value: 'cinematic', label: '🎬 Cinematic', desc: 'Dramatic film-quality shot' },
  { value: 'minimalist', label: '⬜ Minimalist', desc: 'Clean, simple composition' },
  { value: 'abstract', label: '🌀 Abstract', desc: 'Creative abstract art' },
];

function AIImageModal({
  loading,
  quota,
  onClose,
  onGenerate,
}: {
  loading: boolean;
  quota: { used: number; limit: number; tier: string } | null;
  onClose: () => void;
  onGenerate: (prompt: string, style: string) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('photorealistic');

  const remaining = quota ? quota.limit - quota.used : null;
  const canGenerate = prompt.trim().length > 0 && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AI Image Generator</h2>
              <p className="text-xs text-white/50">Powered by DALL·E 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Quota badge */}
          {quota && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              remaining === 0 ? 'bg-red-500/15 text-red-300 border border-red-500/20' :
              remaining !== null && remaining <= 3 ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' :
              'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
              {remaining === 0
                ? `Monthly limit reached (${quota.limit}/${quota.limit} used). Upgrade to generate more.`
                : `${remaining} of ${quota.limit} generations remaining this month`
              }
            </div>
          )}

          {/* Prompt textarea */}
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
              Describe your image
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A professional woman using a laptop in a modern office, golden hour lighting..."
              rows={3}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl text-sm resize-none transition-all outline-none disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#f8fafc',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(139,92,246,0.6)'; e.target.style.boxShadow = '0 0 0 2px rgba(139,92,246,0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
            />
            <p className="text-xs text-white/30 mt-1.5">{prompt.length}/500 characters</p>
          </div>

          {/* Style selector */}
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
              Visual Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AI_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  disabled={loading}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-all disabled:opacity-40 ${
                    style === s.value
                      ? 'border border-violet-400/60 text-white'
                      : 'border border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white/80'
                  }`}
                  style={{
                    background: style === s.value
                      ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(217,70,239,0.15))'
                      : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">{s.label}</p>
                    <p className="text-[10px] text-white/40 truncate">{s.desc}</p>
                  </div>
                  {style === s.value && (
                    <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(prompt, style)}
            disabled={!canGenerate || quota?.limit === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: (canGenerate && quota?.limit !== 0)
                ? 'linear-gradient(135deg, #7c3aed, #a855f7, #d946ef)'
                : 'rgba(255,255,255,0.1)',
              boxShadow: (canGenerate && quota?.limit !== 0) ? '0 4px 20px rgba(139,92,246,0.4)' : 'none',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating with DALL·E 3…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Image
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
