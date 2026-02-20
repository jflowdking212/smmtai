export interface TemplateData {
  id: string;
  name: string;
  category: string;
  thumbnail: string; // Color placeholder
  width: number;
  height: number;
  json: string; // Fabric.js JSON string
}

const CATEGORIES = [
  'Business & Corporate',
  'Food & Restaurant',
  'Fashion & Beauty',
  'Tech & SaaS',
  'Fitness & Health',
  'Travel & Lifestyle',
  'E-commerce & Sale',
  'Motivational & Quotes',
  'Event & Announcement',
  'Social Media',
];

function makeTemplate(
  id: string, name: string, category: string, bg: string,
  textColor: string, accentColor: string, width = 1080, height = 1080,
): TemplateData {
  const json = JSON.stringify({
    version: '6.0.0',
    objects: [
      {
        type: 'Rect',
        left: 0, top: 0,
        width, height,
        fill: bg,
        selectable: false,
      },
      {
        type: 'IText',
        left: width * 0.1,
        top: height * 0.3,
        text: name,
        fontFamily: 'Poppins',
        fontSize: Math.round(width * 0.06),
        fontWeight: 'bold',
        fill: textColor,
      },
      {
        type: 'IText',
        left: width * 0.1,
        top: height * 0.45,
        text: 'Edit this subtitle text',
        fontFamily: 'Inter',
        fontSize: Math.round(width * 0.03),
        fill: textColor + 'AA',
      },
      {
        type: 'Rect',
        left: width * 0.1,
        top: height * 0.6,
        width: width * 0.35,
        height: height * 0.07,
        fill: accentColor,
        rx: 8, ry: 8,
      },
      {
        type: 'IText',
        left: width * 0.15,
        top: height * 0.615,
        text: 'Learn More',
        fontFamily: 'Inter',
        fontSize: Math.round(width * 0.025),
        fontWeight: 'bold',
        fill: '#FFFFFF',
      },
    ],
    background: bg,
  });

  return { id, name, category, thumbnail: bg, width, height, json };
}

// ── Rich Template Engine ──────────────────────────────────────────
type FObj = Record<string, unknown>;

function _rgba(hex: string, a: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function _rect(l: number, t: number, w: number, h: number, fill: string, x: Record<string, unknown> = {}): FObj {
  return { type: 'Rect', left: l, top: t, width: w, height: h, fill, ...x };
}

function _circle(l: number, t: number, r: number, fill: string, x: Record<string, unknown> = {}): FObj {
  return { type: 'Circle', left: l, top: t, radius: r, fill, ...x };
}

function _tri(l: number, t: number, w: number, h: number, fill: string, x: Record<string, unknown> = {}): FObj {
  return { type: 'Triangle', left: l, top: t, width: w, height: h, fill, ...x };
}

function _line(x1: number, y1: number, x2: number, y2: number, s: string, sw: number, x: Record<string, unknown> = {}): FObj {
  return { type: 'Line', x1, y1, x2, y2, stroke: s, strokeWidth: sw, ...x };
}

function _txt(t: string, l: number, tp: number, sz: number, fill: string, x: Record<string, unknown> = {}): FObj {
  return { type: 'IText', left: l, top: tp, text: t, fontFamily: 'Inter', fontSize: sz, fill, ...x };
}

function _cta(l: number, t: number, label: string, w: number, h: number, bg: string, fg: string): FObj[] {
  return [
    _rect(l, t, w, h, bg, { rx: h / 2, ry: h / 2 }),
    _txt(label, l + w * 0.12, t + h * 0.24, Math.round(h * 0.38), fg, { fontWeight: 'bold', fontFamily: 'Poppins' }),
  ];
}

function richTemplate(
  id: string, name: string, category: string,
  w: number, h: number, bg: string, thumb: string,
  objects: FObj[],
): TemplateData {
  return {
    id, name, category,
    thumbnail: thumb,
    width: w, height: h,
    json: JSON.stringify({
      version: '6.0.0',
      objects: [_rect(0, 0, w, h, bg, { selectable: false }), ...objects],
      background: bg,
    }),
  };
}

// Generate 50 templates across categories
export const TEMPLATES: TemplateData[] = [
  // Business & Corporate (1-6)
  makeTemplate('biz-1', 'Corporate Blue', 'Business & Corporate', '#1E3A5F', '#FFFFFF', '#2563EB'),
  makeTemplate('biz-2', 'Professional Gray', 'Business & Corporate', '#F8F9FA', '#111827', '#2563EB'),
  makeTemplate('biz-3', 'Executive Dark', 'Business & Corporate', '#111827', '#FFFFFF', '#F59E0B'),
  makeTemplate('biz-4', 'Startup Modern', 'Business & Corporate', '#FFFFFF', '#111827', '#8B5CF6', 1200, 627),
  makeTemplate('biz-5', 'Conference Banner', 'Business & Corporate', '#0F172A', '#FFFFFF', '#06B6D4', 1600, 900),
  makeTemplate('biz-6', 'Networking Event', 'Business & Corporate', '#1E293B', '#F1F5F9', '#10B981', 1200, 630),

  // Food & Restaurant (7-11)
  makeTemplate('food-1', 'Warm Appetizer', 'Food & Restaurant', '#FEF3C7', '#78350F', '#D97706'),
  makeTemplate('food-2', 'Fresh & Green', 'Food & Restaurant', '#ECFDF5', '#064E3B', '#10B981'),
  makeTemplate('food-3', 'Dark Kitchen', 'Food & Restaurant', '#1C1917', '#FAFAF9', '#EF4444'),
  makeTemplate('food-4', 'Café Vibes', 'Food & Restaurant', '#FDF2F8', '#831843', '#EC4899'),
  makeTemplate('food-5', 'Menu Special', 'Food & Restaurant', '#FFFBEB', '#451A03', '#F59E0B', 1080, 1920),

  // Fashion & Beauty (12-16)
  makeTemplate('fash-1', 'Elegant Noir', 'Fashion & Beauty', '#000000', '#FFFFFF', '#D4AF37'),
  makeTemplate('fash-2', 'Pastel Rose', 'Fashion & Beauty', '#FFF1F2', '#881337', '#F43F5E'),
  makeTemplate('fash-3', 'Minimalist Chic', 'Fashion & Beauty', '#FAFAFA', '#171717', '#A855F7'),
  makeTemplate('fash-4', 'Luxury Gold', 'Fashion & Beauty', '#1C1917', '#D4AF37', '#D4AF37'),
  makeTemplate('fash-5', 'Summer Collection', 'Fashion & Beauty', '#FFF7ED', '#7C2D12', '#FB923C', 1080, 1920),

  // Tech & SaaS (17-21)
  makeTemplate('tech-1', 'Dark Mode UI', 'Tech & SaaS', '#0F172A', '#E2E8F0', '#3B82F6'),
  makeTemplate('tech-2', 'Gradient Tech', 'Tech & SaaS', '#1E1B4B', '#E0E7FF', '#818CF8'),
  makeTemplate('tech-3', 'Clean Product', 'Tech & SaaS', '#FFFFFF', '#111827', '#2563EB'),
  makeTemplate('tech-4', 'Launch Day', 'Tech & SaaS', '#020617', '#F8FAFC', '#22D3EE', 1600, 900),
  makeTemplate('tech-5', 'Feature Update', 'Tech & SaaS', '#F0FDF4', '#14532D', '#22C55E'),

  // Fitness & Health (22-26)
  makeTemplate('fit-1', 'Energy Burst', 'Fitness & Health', '#FEF2F2', '#7F1D1D', '#EF4444'),
  makeTemplate('fit-2', 'Calm Wellness', 'Fitness & Health', '#F0FDFA', '#134E4A', '#14B8A6'),
  makeTemplate('fit-3', 'Dark Gym', 'Fitness & Health', '#18181B', '#FAFAFA', '#F97316'),
  makeTemplate('fit-4', 'Workout Plan', 'Fitness & Health', '#111827', '#F9FAFB', '#10B981', 1080, 1920),
  makeTemplate('fit-5', 'Nutrition Guide', 'Fitness & Health', '#FFFBEB', '#422006', '#84CC16'),

  // Travel & Lifestyle (27-31)
  makeTemplate('travel-1', 'Sunset Vibes', 'Travel & Lifestyle', '#FFF7ED', '#431407', '#F97316'),
  makeTemplate('travel-2', 'Ocean Blue', 'Travel & Lifestyle', '#EFF6FF', '#1E3A8A', '#3B82F6'),
  makeTemplate('travel-3', 'Adventure Dark', 'Travel & Lifestyle', '#1A2332', '#F1F5F9', '#22D3EE'),
  makeTemplate('travel-4', 'Destination Card', 'Travel & Lifestyle', '#FFFFFF', '#0F172A', '#0EA5E9', 1000, 1500),
  makeTemplate('travel-5', 'Wanderlust Story', 'Travel & Lifestyle', '#0C4A6E', '#F0F9FF', '#38BDF8', 1080, 1920),

  // E-commerce & Sale (32-36)
  makeTemplate('ecom-1', 'Flash Sale Red', 'E-commerce & Sale', '#FEF2F2', '#991B1B', '#DC2626'),
  makeTemplate('ecom-2', 'Black Friday', 'E-commerce & Sale', '#000000', '#FFFFFF', '#FBBF24'),
  makeTemplate('ecom-3', 'Product Showcase', 'E-commerce & Sale', '#F9FAFB', '#111827', '#7C3AED'),
  makeTemplate('ecom-4', 'Summer Sale', 'E-commerce & Sale', '#FEF9C3', '#713F12', '#EAB308'),
  makeTemplate('ecom-5', 'New Arrival', 'E-commerce & Sale', '#FFFFFF', '#18181B', '#EC4899', 1080, 1920),

  // Motivational & Quotes (37-42)
  makeTemplate('quote-1', 'Minimal Quote', 'Motivational & Quotes', '#FFFFFF', '#111827', '#6366F1'),
  makeTemplate('quote-2', 'Dark Inspiration', 'Motivational & Quotes', '#0F172A', '#F8FAFC', '#F59E0B'),
  makeTemplate('quote-3', 'Soft Gradient', 'Motivational & Quotes', '#F5F3FF', '#4C1D95', '#8B5CF6'),
  makeTemplate('quote-4', 'Bold Statement', 'Motivational & Quotes', '#DC2626', '#FFFFFF', '#FFFFFF'),
  makeTemplate('quote-5', 'Nature Calm', 'Motivational & Quotes', '#F0FDF4', '#14532D', '#16A34A'),
  makeTemplate('quote-6', 'Morning Motivation', 'Motivational & Quotes', '#FFFBEB', '#78350F', '#D97706', 1080, 1920),

  // Event & Announcement (43-47)
  makeTemplate('event-1', 'Webinar Blue', 'Event & Announcement', '#1E40AF', '#FFFFFF', '#60A5FA'),
  makeTemplate('event-2', 'Conference Dark', 'Event & Announcement', '#111827', '#F9FAFB', '#A78BFA', 1200, 630),
  makeTemplate('event-3', 'Party Night', 'Event & Announcement', '#4C1D95', '#FFFFFF', '#F472B6'),
  makeTemplate('event-4', 'Workshop Invite', 'Event & Announcement', '#FFFFFF', '#1E293B', '#0D9488'),
  makeTemplate('event-5', 'Live Stream', 'Event & Announcement', '#7F1D1D', '#FFFFFF', '#FCA5A5', 1280, 720),

  // Social Media (48-50)
  makeTemplate('social-1', 'Carousel Slide', 'Social Media', '#F8FAFC', '#0F172A', '#2563EB'),
  makeTemplate('social-2', 'Reel Cover', 'Social Media', '#18181B', '#FAFAFA', '#EC4899', 1080, 1920),
  makeTemplate('social-3', 'Pin Design', 'Social Media', '#FFFFFF', '#111827', '#E11D48', 1000, 1500),

  // ═══════════════════════════════════════════════════════════════════
  // ── 10 Premium Rich Templates ─ GenZ Modern ─ Canva-Quality ──────
  // ═══════════════════════════════════════════════════════════════════

  // 1 · Neo-Brutalist Drop ─ E-commerce · Instagram Post 1080×1080
  richTemplate('rich-ecom', 'Neo-Brutalist Drop', 'E-commerce & Sale', 1080, 1080, '#18181B',
    'linear-gradient(135deg,#18181B 0%,#F43F5E 56%,#FB923C 100%)',
    (() => {
      const w = 1080, h = 1080, m = 86;
      return [
        _rect(-108, 280, 1404, 172, _rgba('#F43F5E', 0.08), { angle: -14 }),
        _rect(-54, 410, 1296, 64, _rgba('#FB923C', 0.05), { angle: -14 }),
        _rect(m + 10, h * 0.44 + 10, w - m * 2, h * 0.38, '#FB923C', { rx: 22, ry: 22 }),
        _rect(m, h * 0.44, w - m * 2, h * 0.38, '#27272A', { rx: 22, ry: 22, stroke: '#FAFAFA', strokeWidth: 3 }),
        _rect(m * 1.5, h * 0.49, w * 0.38, h * 0.27, _rgba('#F43F5E', 0.06), { rx: 14, ry: 14 }),
        _line(m * 1.5 + w * 0.42, h * 0.51, m * 1.5 + w * 0.42, h * 0.74, _rgba('#FAFAFA', 0.06), 1),
        _rect(m, 60, 280, 36, '#F43F5E', { rx: 18, ry: 18 }),
        _txt('FRESH DROP', m + 28, 68, 14, '#FFFFFF', { fontWeight: 'bold', charSpacing: 120, fontFamily: 'Poppins' }),
        _circle(w * 0.74, h * 0.42, 56, '#FB923C'),
        _txt('$49', w * 0.755, h * 0.445, 28, '#18181B', { fontWeight: 'bold', fontFamily: 'Poppins' }),
        _circle(w * 0.87, 40, 28, _rgba('#F43F5E', 0.4)),
        _circle(w * 0.93, 82, 12, _rgba('#FB923C', 0.3)),
        _circle(130, h * 0.42, 10, _rgba('#F43F5E', 0.25)),
        _circle(w * 0.75, h * 0.93, 16, _rgba('#FB923C', 0.3)),
        _line(m, 115, 440, 115, _rgba('#F43F5E', 0.18), 2),
        _txt('Fresh Drop', m, 160, 72, '#FAFAFA', { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('Limited edition drops every\nweek. Don\u2019t sleep on it.', m, 250, 28, '#FAFAFAAA', { lineHeight: 1.4 }),
        ..._cta(m, h * 0.84, 'Shop Now', 240, 56, '#F43F5E', '#FFFFFF'),
      ];
    })(),
  ),

  // 2 · Glass Luxe Lookbook ─ Fashion · Pinterest Pin 1000×1500
  richTemplate('rich-fash', 'Glass Luxe Lookbook', 'Fashion & Beauty', 1000, 1500, '#0D0520',
    'linear-gradient(135deg,#0D0520 0%,#A855F7 56%,#F472B6 100%)',
    (() => {
      const w = 1000, h = 1500;
      return [
        _circle(-140, -90, 380, _rgba('#A855F7', 0.3)),
        _circle(w * 0.6, h * 0.56, 320, _rgba('#F472B6', 0.25)),
        _circle(w * 0.72, -180, 200, _rgba('#A855F7', 0.12)),
        _circle(100, h * 0.82, 150, _rgba('#F472B6', 0.1)),
        _rect(70, 195, 860, 1110, _rgba('#1A0F30', 0.6), { rx: 32, ry: 32, stroke: _rgba('#FAF5FF', 0.1), strokeWidth: 1.5 }),
        _rect(70, 195, 860, 7, _rgba('#F472B6', 0.5), { rx: 32, ry: 32 }),
        _circle(w * 0.78, h * 0.18, 65, 'transparent', { stroke: _rgba('#F472B6', 0.2), strokeWidth: 2 }),
        _circle(w * 0.83, h * 0.22, 35, 'transparent', { stroke: _rgba('#A855F7', 0.15), strokeWidth: 1.5 }),
        _circle(160, 150, 9, _rgba('#F472B6', 0.6)),
        _circle(880, 720, 7, _rgba('#A855F7', 0.5)),
        _circle(520, 1365, 11, _rgba('#F472B6', 0.4)),
        _circle(60, 930, 6, _rgba('#A855F7', 0.3)),
        _circle(400, 155, 5, _rgba('#F472B6', 0.25)),
        _line(140, 840, 860, 840, _rgba('#FAF5FF', 0.06), 1),
        _rect(560, 930, 300, 260, _rgba('#1A0F30', 0.45), { rx: 18, ry: 18, stroke: _rgba('#FAF5FF', 0.08), strokeWidth: 1 }),
        _rect(560, 930, 300, 5, _rgba('#A855F7', 0.3), { rx: 18, ry: 18 }),
        _txt('New Collection', 120, 300, 66, '#FAF5FF', { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('Curated looks for the\nmodern aesthetic.', 120, 395, 26, _rgba('#E9D5FF', 0.75), { lineHeight: 1.4 }),
        ..._cta(120, h * 0.72, 'Explore Styles', 260, 52, '#F472B6', '#0D0520'),
      ];
    })(),
  ),

  // 3 · Terminal Launch ─ Tech · YouTube Thumbnail 1280×720
  richTemplate('rich-tech', 'Terminal Launch', 'Tech & SaaS', 1280, 720, '#030712',
    'linear-gradient(135deg,#030712 0%,#06B6D4 56%,#818CF8 100%)',
    (() => {
      const w = 1280, h = 720;
      const objects: FObj[] = [];
      for (let dx = 70; dx < w; dx += 70) {
        for (let dy = 40; dy < h; dy += 40) {
          objects.push(_circle(dx, dy, 1.5, _rgba('#E2E8F0', 0.04)));
        }
      }
      objects.push(
        _circle(w * 0.32, h * 0.35, w * 0.28, _rgba('#06B6D4', 0.05)),
      );
      const fL = 141, fT = 65, fW = 998, fH = 576;
      objects.push(
        _rect(fL + 7, fT + 7, fW, fH, _rgba('#06B6D4', 0.2), { rx: 16, ry: 16 }),
        _rect(fL, fT, fW, fH, '#0F172A', { rx: 16, ry: 16, stroke: '#06B6D4', strokeWidth: 2.5 }),
        _rect(fL, fT, fW, 38, _rgba('#06B6D4', 0.1), { rx: 16, ry: 16 }),
        _rect(fL, fT + 37, fW, 1, _rgba('#06B6D4', 0.08)),
        _circle(fL + 44, fT + 15, 5, _rgba('#818CF8', 0.6)),
        _circle(fL + 68, fT + 15, 5, _rgba('#06B6D4', 0.4)),
        _circle(fL + 92, fT + 15, 5, _rgba('#E2E8F0', 0.15)),
        _rect(fL + fW - 120, fT + 8, 100, 22, _rgba('#818CF8', 0.15), { rx: 11, ry: 11 }),
        _txt('v2.0', fL + fW - 105, fT + 12, 11, _rgba('#818CF8', 0.7), { fontFamily: 'Poppins', fontWeight: 'bold' }),
      );
      const cm = 20;
      objects.push(
        _line(fL, fT + cm, fL, fT, _rgba('#818CF8', 0.3), 2.5),
        _line(fL, fT, fL + cm, fT, _rgba('#818CF8', 0.3), 2.5),
        _line(fL + fW, fT + fH - cm, fL + fW, fT + fH, _rgba('#818CF8', 0.3), 2.5),
        _line(fL + fW, fT + fH, fL + fW - cm, fT + fH, _rgba('#818CF8', 0.3), 2.5),
        _line(fL + 70, fT + 58, fL + 70, fT + fH - 20, _rgba('#06B6D4', 0.05), 1),
        _txt('Ship Faster', fL + 100, fT + 80, 60, '#E2E8F0', { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('Dev tools that actually\nspark joy.', fL + 100, fT + 155, 22, _rgba('#94A3B8', 0.85), { lineHeight: 1.35 }),
        ..._cta(fL + 100, h * 0.72, 'Try Free', 200, 48, '#06B6D4', '#030712'),
      );
      return objects;
    })(),
  ),

  // 4 · Editorial Pulse ─ Business · LinkedIn Post 1200×1200
  richTemplate('rich-biz', 'Editorial Pulse', 'Business & Corporate', 1200, 1200, '#0B0F1A',
    'linear-gradient(135deg,#0B0F1A 0%,#2563EB 56%,#06D6A0 100%)',
    (() => {
      const w = 1200, h = 1200, colW = 420;
      return [
        _rect(0, 0, colW, h, '#2563EB'),
        _rect(0, h * 0.72, colW, h * 0.28, _rgba('#06D6A0', 0.15)),
        _txt('EDITORIAL', 54, h * 0.22, 22, _rgba('#F1F5F9', 0.5), { angle: -90, fontWeight: 'bold', charSpacing: 140, fontFamily: 'Poppins' }),
        _txt('2026', 96, 66, 18, _rgba('#F1F5F9', 0.35), { fontWeight: 'bold', charSpacing: 80, fontFamily: 'Poppins' }),
        _circle(300, 66, 12, _rgba('#06D6A0', 0.45)),
        _line(96, 102, 336, 102, _rgba('#F1F5F9', 0.12), 1),
        _circle(144, h * 0.88, 8, _rgba('#F1F5F9', 0.25)),
        _circle(216, h * 0.92, 6, _rgba('#06D6A0', 0.3)),
        _rect(colW + 36, h * 0.06, w - colW - 72, h * 0.88, _rgba('#151D2E', 0.95), { rx: 24, ry: 24 }),
        _line(colW + 84, h * 0.14, w - 72, h * 0.14, _rgba('#2563EB', 0.12), 1),
        _line(colW + 84, h * 0.62, w * 0.82, h * 0.62, _rgba('#2563EB', 0.08), 1),
        _line(colW + 84, h * 0.82, w - 72, h * 0.82, _rgba('#2563EB', 0.08), 1),
        _txt('\u275D', colW + 72, h * 0.16, 64, _rgba('#2563EB', 0.08), { fontFamily: 'Georgia' }),
        _circle(colW + 84, h * 0.86, 16, _rgba('#2563EB', 0.25), { stroke: _rgba('#2563EB', 0.35), strokeWidth: 2 }),
        _rect(colW + 120, h * 0.855, 100, 6, _rgba('#F1F5F9', 0.1), { rx: 3, ry: 3 }),
        _rect(colW + 120, h * 0.872, 65, 4, _rgba('#F1F5F9', 0.06), { rx: 3, ry: 3 }),
        _txt('Market Insights', colW + 84, h * 0.24, 52, '#F1F5F9', { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('Data-driven strategies\nfor Q1 growth.', colW + 84, h * 0.32, 24, _rgba('#94A3B8', 0.8), { lineHeight: 1.4 }),
        ..._cta(colW + 84, h * 0.7, 'Read Report', 240, 52, '#06D6A0', '#0B0F1A'),
      ];
    })(),
  ),

  // 5 · Bento Threads ─ Social Media · Threads 1200×675
  richTemplate('rich-social', 'Bento Threads', 'Social Media', 1200, 675, '#042F2E',
    'linear-gradient(135deg,#042F2E 0%,#14B8A6 56%,#FB923C 100%)',
    (() => {
      const w = 1200, h = 675;
      return [
        _circle(984, -54, 240, _rgba('#14B8A6', 0.07)),
        _circle(-96, 527, 192, _rgba('#FB923C', 0.06)),
        _rect(36, 67, 432, 270, _rgba('#14B8A6', 0.1), { rx: 20, ry: 20, angle: -3.5 }),
        _rect(684, 40, 456, 283, _rgba('#FB923C', 0.1), { rx: 20, ry: 20, angle: 2.5 }),
        _rect(144, 101, 912, 459, _rgba('#0F5E5C', 0.94), { rx: 24, ry: 24, stroke: _rgba('#F0FDFA', 0.08), strokeWidth: 1.5 }),
        _rect(144, 101, 912, 5, _rgba('#FB923C', 0.4), { rx: 24, ry: 24 }),
        _circle(216, 148, 15, _rgba('#14B8A6', 0.45), { stroke: _rgba('#0F5E5C', 0.8), strokeWidth: 2 }),
        _circle(246, 148, 15, _rgba('#FB923C', 0.45), { stroke: _rgba('#0F5E5C', 0.8), strokeWidth: 2 }),
        _circle(276, 148, 15, _rgba('#14B8A6', 0.3), { stroke: _rgba('#0F5E5C', 0.8), strokeWidth: 2 }),
        _rect(306, 140, 60, 18, _rgba('#F0FDFA', 0.05), { rx: 9, ry: 9 }),
        _circle(888, 499, 9, _rgba('#FB923C', 0.5)),
        _circle(910, 507, 6, _rgba('#14B8A6', 0.4)),
        _circle(902, 488, 5, _rgba('#FB923C', 0.3)),
        _line(240, 405, 960, 405, _rgba('#F0FDFA', 0.05), 1),
        _rect(744, 432, 264, 81, _rgba('#14B8A6', 0.05), { rx: 12, ry: 12 }),
        _txt('Hot Take', 216, 195, 50, '#F0FDFA', { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('Honest conversations, no filter.\nWhat\u2019s your take?', 216, 260, 20, _rgba('#99F6E4', 0.7), { lineHeight: 1.4 }),
        ..._cta(216, h * 0.72, 'Join Thread', 220, 46, '#14B8A6', '#042F2E'),
      ];
    })(),
  ),

  // 6 · Gradient Feast ─ Food · IG Story 1080×1920
  richTemplate('rich-food', 'Gradient Feast', 'Food & Restaurant', 1080, 1920, '#1A1412',
    'linear-gradient(135deg,#1A1412 0%,#F97316 56%,#FBBF24 100%)',
    (() => {
      const w = 1080, h = 1920, m = 86;
      return [
        _circle(-194, h * 0.5, 454, _rgba('#F97316', 0.35)),
        _circle(w * 0.3, h * 0.66, 389, _rgba('#FBBF24', 0.28)),
        _circle(w * 0.7, -154, 302, _rgba('#F97316', 0.1)),
        _circle(w * 0.85, h * 0.33, 194, _rgba('#FBBF24', 0.08)),
        _rect(0, h * 0.63, w, h * 0.37, _rgba('#2D2420', 0.88)),
        _rect(65, h * 0.67, w - 130, h * 0.27, _rgba('#1A1412', 0.45), { rx: 20, ry: 20, stroke: _rgba('#FFF7ED', 0.05), strokeWidth: 1 }),
        _rect(65, h * 0.67, w - 130, 6, _rgba('#FBBF24', 0.38), { rx: 20, ry: 20 }),
        _line(120, h * 0.76, w - 120, h * 0.76, _rgba('#FFF7ED', 0.05), 1),
        _line(120, h * 0.84, w - 120, h * 0.84, _rgba('#FFF7ED', 0.05), 1),
        _circle(w * 0.44, h * 0.04, 27, _rgba('#2D2420', 0.16)),
        _circle(w * 0.5, h * 0.02, 19, _rgba('#2D2420', 0.1)),
        _circle(w * 0.41, h * 0.075, 22, _rgba('#2D2420', 0.08)),
        _circle(w * 0.3, h * 0.32, 108, _rgba('#2D2420', 0.08), { stroke: _rgba('#2D2420', 0.18), strokeWidth: 2 }),
        _circle(w * 0.3, h * 0.32, 54, _rgba('#2D2420', 0.05)),
        _circle(w * 0.88, h * 0.59, 8, _rgba('#FBBF24', 0.3)),
        _circle(w * 0.08, h * 0.05, 6, _rgba('#F97316', 0.2)),
        _rect(w * 0.72, h * 0.71, 160, 32, _rgba('#FBBF24', 0.15), { rx: 16, ry: 16 }),
        _txt('Tonight\u2019s Menu', m, h * 0.15, 68, '#FFF7ED', { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('Farm to table,\ncrafted with soul.', m, h * 0.2, 28, _rgba('#FED7AA', 0.7), { lineHeight: 1.4 }),
        ..._cta(m, h * 0.54, 'Reserve Table', 280, 58, '#F97316', '#1A1412'),
      ];
    })(),
  ),

  // 7 · Sticker Beast ─ Fitness · TikTok 1080×1920
  richTemplate('rich-fit', 'Sticker Beast', 'Fitness & Health', 1080, 1920, '#042713',
    'linear-gradient(135deg,#042713 0%,#22C55E 56%,#A3E635 100%)',
    (() => {
      const w = 1080, h = 1920;
      return [
        _circle(43, 58, 108, _rgba('#22C55E', 0.6), { stroke: _rgba('#ECFDF5', 0.12), strokeWidth: 3 }),
        _circle(w * 0.72, 77, 140, _rgba('#A3E635', 0.6), { stroke: _rgba('#ECFDF5', 0.12), strokeWidth: 3 }),
        _rect(w * 0.68, h * 0.54, 216, 192, _rgba('#22C55E', 0.25), { angle: 22, rx: 12, ry: 12 }),
        _tri(32, h * 0.78, 151, 134, _rgba('#A3E635', 0.25), { angle: -14 }),
        _rect(76, h * 0.14, w - 152, h * 0.48, _rgba('#0F3D22', 0.92), { rx: 28, ry: 28, stroke: _rgba('#ECFDF5', 0.1), strokeWidth: 2.5 }),
        _rect(76, h * 0.14, w - 152, 10, '#A3E635', { rx: 28, ry: 28 }),
        _rect(152, h * 0.55, w * 0.72, 19, _rgba('#ECFDF5', 0.06), { rx: 10, ry: 10 }),
        _rect(152, h * 0.55, w * 0.46, 19, _rgba('#A3E635', 0.5), { rx: 10, ry: 10 }),
        _circle(152, h * 0.66, 11, _rgba('#22C55E', 0.45)),
        _circle(w * 0.9, h * 0.37, 7, _rgba('#A3E635', 0.5)),
        _circle(w * 0.47, h * 0.1, 9, _rgba('#22C55E', 0.3)),
        _circle(w * 0.27, h * 0.86, 13, _rgba('#A3E635', 0.25)),
        _circle(w * 0.84, h * 0.82, 9, _rgba('#22C55E', 0.2)),
        _circle(w * 0.45, h * 0.72, 54, 'transparent', { stroke: _rgba('#22C55E', 0.1), strokeWidth: 2 }),
        _circle(w * 0.85, h * 0.12, 41, '#A3E635', { stroke: _rgba('#ECFDF5', 0.15), strokeWidth: 2 }),
        _txt('30', w * 0.858, h * 0.128, 24, '#042713', { fontWeight: 'bold', fontFamily: 'Poppins' }),
        _txt('30 Day Challenge', 130, h * 0.19, 60, '#ECFDF5', { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('Transform your body.\nLevel up your life.', 130, h * 0.24, 26, _rgba('#BBF7D0', 0.7), { lineHeight: 1.4 }),
        ..._cta(130, h * 0.44, 'Start Now', 260, 58, '#A3E635', '#042713'),
      ];
    })(),
  ),

  // 8 · Swiss Wisdom ─ Quotes · X/Twitter 1600×900
  richTemplate('rich-quote', 'Swiss Wisdom', 'Motivational & Quotes', 1600, 900, '#0F172A',
    'linear-gradient(135deg,#0F172A 0%,#38BDF8 56%,#C084FC 100%)',
    (() => {
      const w = 1600, h = 900;
      const objects: FObj[] = [];
      for (let i = 1; i <= 5; i++) {
        objects.push(
          _line((w / 6) * i, 0, (w / 6) * i, h, _rgba('#F8FAFC', 0.03), 1),
          _line(0, (h / 6) * i, w, (h / 6) * i, _rgba('#F8FAFC', 0.03), 1),
        );
      }
      objects.push(
        _circle(w / 6, h / 6, 3.5, _rgba('#38BDF8', 0.18)),
        _circle((w / 6) * 5, h / 6, 3.5, _rgba('#38BDF8', 0.18)),
        _circle(w / 6, (h / 6) * 5, 3.5, _rgba('#C084FC', 0.18)),
        _circle((w / 6) * 5, (h / 6) * 5, 3.5, _rgba('#C084FC', 0.18)),
        _circle(w / 2, h / 2, 3.5, _rgba('#38BDF8', 0.1)),
      );
      const cL = 160, cT = 90, cW = 1280, cH = 720;
      objects.push(
        _rect(cL, cT, cW, cH, _rgba('#1E293B', 0.95), { rx: 20, ry: 20, stroke: _rgba('#38BDF8', 0.1), strokeWidth: 1.5 }),
        _rect(cL, cT, cW, 5, _rgba('#38BDF8', 0.55), { rx: 20, ry: 20 }),
        _txt('\u275D', cL + 56, cT + 35, 90, _rgba('#38BDF8', 0.06), { fontFamily: 'Georgia' }),
        _line(cL + 120, cT + cH * 0.64, cL + cW - 120, cT + cH * 0.64, _rgba('#F8FAFC', 0.05), 1),
        _circle(cL + 120, cT + cH * 0.74, 10, _rgba('#38BDF8', 0.22), { stroke: _rgba('#38BDF8', 0.28), strokeWidth: 1.5 }),
        _rect(cL + 148, cT + cH * 0.737, 96, 5, _rgba('#F8FAFC', 0.08), { rx: 3, ry: 3 }),
        _rect(cL + 148, cT + cH * 0.755, 60, 4, _rgba('#F8FAFC', 0.05), { rx: 3, ry: 3 }),
      );
      const cs = 32;
      objects.push(
        _line(cL, cT + cs, cL, cT, _rgba('#C084FC', 0.2), 2),
        _line(cL, cT, cL + cs, cT, _rgba('#C084FC', 0.2), 2),
        _line(cL + cW, cT + cH - cs, cL + cW, cT + cH, _rgba('#C084FC', 0.2), 2),
        _line(cL + cW, cT + cH, cL + cW - cs, cT + cH, _rgba('#C084FC', 0.2), 2),
        _txt('Dream. Build. Ship.', cL + 120, cT + 120, 54, '#F8FAFC', { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('The only limit is the one\nyou set for yourself.', cL + 120, cT + 195, 24, _rgba('#CBD5E1', 0.75), { lineHeight: 1.4 }),
        ..._cta(cL + 120, cT + cH * 0.82, 'Share This', 220, 48, '#38BDF8', '#0F172A'),
      );
      return objects;
    })(),
  ),

  // 9 · Ribbon Hype ─ Events · YouTube Banner 1920×1080
  richTemplate('rich-event', 'Ribbon Hype', 'Event & Announcement', 1920, 1080, '#1E0A3C',
    'linear-gradient(135deg,#1E0A3C 0%,#8B5CF6 56%,#22D3EE 100%)',
    (() => {
      const w = 1920, h = 1080;
      const objects: FObj[] = [
        _circle(w * 0.4, h * 0.4, 384, _rgba('#8B5CF6', 0.06)),
        _rect(-192, h * 0.1, w * 1.2, 92, _rgba('#8B5CF6', 0.28), { angle: -7 }),
        _rect(-154, h * 0.23, w * 1.16, 92, _rgba('#22D3EE', 0.32), { angle: -7 }),
        _rect(-115, h * 0.36, w * 1.14, 92, _rgba('#F5F3FF', 0.8), { angle: -7, stroke: _rgba('#DDD6FE', 0.06), strokeWidth: 1 }),
      ];
      const cx = [0.12, 0.28, 0.41, 0.55, 0.68, 0.78, 0.88, 0.95, 0.07, 0.35, 0.62, 0.82];
      const cy = [0.08, 0.52, 0.91, 0.14, 0.75, 0.38, 0.62, 0.05, 0.45, 0.82, 0.18, 0.7];
      const cr = [5, 4, 6, 3, 5, 4, 3, 5, 6, 4, 3, 5];
      const cc = ['#8B5CF6', '#22D3EE', '#F5F3FF', '#DDD6FE', '#8B5CF6', '#22D3EE', '#F5F3FF', '#8B5CF6', '#22D3EE', '#DDD6FE', '#8B5CF6', '#22D3EE'];
      const ca = [0.35, 0.3, 0.4, 0.25, 0.35, 0.3, 0.2, 0.4, 0.3, 0.25, 0.35, 0.3];
      for (let i = 0; i < 12; i++) {
        objects.push(_circle(w * cx[i], h * cy[i], cr[i], _rgba(cc[i], ca[i])));
      }
      const bSz = 72, bY = h * 0.72, bX = w * 0.58, bGap = 92;
      for (let i = 0; i < 3; i++) {
        objects.push(_rect(bX + i * bGap, bY, bSz, bSz, _rgba('#F5F3FF', 0.1), { rx: 10, ry: 10, stroke: _rgba('#22D3EE', 0.22), strokeWidth: 2 }));
      }
      objects.push(
        _txt(':', bX + bSz + 5, bY + 14, 32, _rgba('#22D3EE', 0.35), { fontWeight: 'bold' }),
        _txt(':', bX + bSz * 2 + 25, bY + 14, 32, _rgba('#22D3EE', 0.35), { fontWeight: 'bold' }),
        _rect(w * 0.88, 43, 100, 28, _rgba('#22D3EE', 0.75), { rx: 14, ry: 14 }),
        _txt('LIVE', w * 0.895, 49, 13, '#1E0A3C', { fontWeight: 'bold', fontFamily: 'Poppins', charSpacing: 60 }),
        _txt('Going Live', 154, h * 0.2, 72, '#F5F3FF', { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('Don\u2019t miss the biggest\ndrop of 2026.', 154, h * 0.32, 28, _rgba('#DDD6FE', 0.7), { lineHeight: 1.4 }),
        ..._cta(154, h * 0.72, 'Set Reminder', 260, 54, '#22D3EE', '#1E0A3C'),
      );
      return objects;
    })(),
  ),

  // 10 · Split Wanderlust ─ Travel · Facebook Ad 1200×628
  richTemplate('rich-travel', 'Split Wanderlust', 'Travel & Lifestyle', 1200, 628, '#072135',
    'linear-gradient(135deg,#072135 0%,#0EA5E9 56%,#FBBF24 100%)',
    (() => {
      const w = 1200, h = 628;
      return [
        _rect(0, 0, w * 0.52, h, '#0E3A5C'),
        _rect(0, 0, w * 0.52, h, _rgba('#FBBF24', 0.05)),
        _rect(w * 0.52, 0, w * 0.48, h, '#F0F9FF'),
        _circle(w * 0.18, h * 0.35, 130, _rgba('#FBBF24', 0.12)),
        _circle(w * 0.19, h * 0.36, 105, 'transparent', { stroke: _rgba('#F0F9FF', 0.3), strokeWidth: 3 }),
        _circle(w * 0.2, h * 0.38, 48, _rgba('#F0F9FF', 0.07)),
        _circle(w * 0.44 - 12, h * 0.1, 12, _rgba('#FBBF24', 0.6)),
        _tri(w * 0.44 - 16, h * 0.13, 16, 24, _rgba('#FBBF24', 0.6), { angle: 180 }),
        _line(w * 0.58, h * 0.14, w * 0.92, h * 0.14, _rgba('#0E3A5C', 0.15), 2),
        _line(w * 0.58, h * 0.2, w * 0.78, h * 0.2, _rgba('#0E3A5C', 0.08), 1),
        _circle(w * 0.58, h * 0.72, 7, _rgba('#FBBF24', 0.6)),
        _circle(w * 0.58 + 28, h * 0.72, 7, _rgba('#FBBF24', 0.6)),
        _circle(w * 0.58 + 56, h * 0.72, 7, _rgba('#FBBF24', 0.6)),
        _circle(w * 0.58 + 84, h * 0.72, 7, _rgba('#FBBF24', 0.6)),
        _circle(w * 0.58 + 112, h * 0.72, 7, _rgba('#BAE6FD', 0.12)),
        _rect(0, h * 0.9, w, h * 0.1, _rgba('#FBBF24', 0.06)),
        _circle(w * 0.92, h * 0.06, 16, _rgba('#0E3A5C', 0.1)),
        _line(w * 0.08, h * 0.82, w * 0.42, h * 0.82, _rgba('#F0F9FF', 0.06), 1),
        _txt('Escape Plan', w * 0.06, h * 0.24, 46, _rgba('#F0F9FF', 0.95), { fontFamily: 'Poppins', fontWeight: 'bold' }),
        _txt('Last-minute getaways\nstarting at $299.', w * 0.06, h * 0.4, 18, _rgba('#BAE6FD', 0.75), { lineHeight: 1.4 }),
        ..._cta(w * 0.58, h * 0.5, 'Book Now', 220, 48, '#FBBF24', '#072135'),
      ];
    })(),
  ),

];

export function getTemplatesByCategory(category?: string): TemplateData[] {
  if (!category) return TEMPLATES;
  return TEMPLATES.filter((t) => t.category === category);
}

export function getCategories(): string[] {
  return CATEGORIES;
}
