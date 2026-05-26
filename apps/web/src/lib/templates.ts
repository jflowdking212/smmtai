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

// --- NEW 40 PREMIUM TEMPLATES ---
TEMPLATES.push({
  "id": "new_tmpl_2v9xn4b6",
  "name": "✨ IG E-Commerce Showroom",
  "category": "E-commerce & Sale",
  "thumbnail": "#0f172a",
  "width": 1080,
  "height": 1080,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_s9dx552a\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#0f172a\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_0tqnp8wl\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":150,\"radius\":80,\"fill\":\"rgba(59, 130, 246, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_epihj8lc\",\"originX\":\"left\",\"originY\":\"top\",\"left\":900,\"top\":900,\"radius\":120,\"fill\":\"rgba(245, 158, 11, 0.12)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_k85fjafb\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":100,\"width\":880,\"height\":520,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_y16fp11w\",\"originX\":\"left\",\"originY\":\"top\",\"left\":115,\"top\":345,\"width\":850,\"fill\":\"#64748b\",\"fontSize\":26,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Drop Product Image Here\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_tosb0fah\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":660,\"width\":880,\"height\":320,\"fill\":\"rgba(255, 255, 255, 0.04)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_nm1z1ywq\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":700,\"width\":800,\"fill\":\"#ffffff\",\"fontSize\":54,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"NEW ARRIVALS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_pv1roynq\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":770,\"width\":800,\"fill\":\"#94a3b8\",\"fontSize\":24,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Upgrade your lifestyle with our premium catalog.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_3gktb0sr\",\"originX\":\"left\",\"originY\":\"top\",\"left\":390,\"top\":850,\"width\":300,\"height\":56,\"fill\":\"#f59e0b\",\"rx\":14,\"ry\":14,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_o037o27r\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":866,\"width\":300,\"fill\":\"#ffffff\",\"fontSize\":18,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SHOP COLLECTION\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_o64fi2a5",
  "name": "✨ IG Luxury Real Estate",
  "category": "Business & Corporate",
  "thumbnail": "#022c22",
  "width": 1080,
  "height": 1080,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_ro6u92sk\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#022c22\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_ssl3j8j2\",\"originX\":\"left\",\"originY\":\"top\",\"left\":40,\"top\":40,\"width\":1000,\"height\":1000,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#d97706\",\"strokeWidth\":3},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_uzitr9q3\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":100,\"width\":400,\"height\":540,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":22,\"ry\":22,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_ot3mzw1g\",\"originX\":\"left\",\"originY\":\"top\",\"left\":115,\"top\":355,\"width\":370,\"fill\":\"#64748b\",\"fontSize\":20,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Living Area\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_l9cwjivy\",\"originX\":\"left\",\"originY\":\"top\",\"left\":540,\"top\":100,\"width\":440,\"height\":240,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":22,\"ry\":22,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_uc5x8i2s\",\"originX\":\"left\",\"originY\":\"top\",\"left\":555,\"top\":205,\"width\":410,\"fill\":\"#64748b\",\"fontSize\":16,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Kitchen\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_m9q6a4jy\",\"originX\":\"left\",\"originY\":\"top\",\"left\":540,\"top\":380,\"width\":440,\"height\":260,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":22,\"ry\":22,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_kuo3ujdm\",\"originX\":\"left\",\"originY\":\"top\",\"left\":555,\"top\":495,\"width\":410,\"fill\":\"#64748b\",\"fontSize\":16,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Exterior\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_o32f5564\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":720,\"width\":880,\"fill\":\"#ffffff\",\"fontSize\":44,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"THE EMERALD RESIDENCE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_5stxo7eg\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":780,\"width\":880,\"fill\":\"#d97706\",\"fontSize\":22,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Luxurious 4 Bedroom Villa • Burnt Gold Accents\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_6burzyes\",\"originX\":\"left\",\"originY\":\"top\",\"left\":415,\"top\":850,\"width\":250,\"height\":52,\"fill\":\"#d97706\",\"rx\":8,\"ry\":8,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_rzham5dv\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":866,\"width\":250,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"VIEW DETAILS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_01dpkgf9",
  "name": "✨ IG Bold Fitness Motivation",
  "category": "Fitness & Health",
  "thumbnail": "#000000",
  "width": 1080,
  "height": 1080,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_hfbzi5ok\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#000000\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_qwypyric\",\"originX\":\"left\",\"originY\":\"top\",\"left\":-100,\"top\":300,\"width\":1280,\"height\":180,\"fill\":\"#84cc16\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"angle\":-8},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_r9zplyc7\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":355,\"width\":1280,\"fill\":\"#000000\",\"fontSize\":78,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"NO LIMITS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true,\"angle\":-8},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_6gxpr3sp\",\"originX\":\"left\",\"originY\":\"top\",\"left\":80,\"top\":80,\"width\":420,\"height\":800,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_ev58qqa0\",\"originX\":\"left\",\"originY\":\"top\",\"left\":95,\"top\":465,\"width\":390,\"fill\":\"#64748b\",\"fontSize\":21,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Athlete Action\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_85229oh1\",\"originX\":\"left\",\"originY\":\"top\",\"left\":540,\"top\":520,\"width\":460,\"height\":480,\"fill\":\"rgba(255,255,255,0.06)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ujul6sfy\",\"originX\":\"left\",\"originY\":\"top\",\"left\":770,\"top\":560,\"width\":400,\"fill\":\"#84cc16\",\"fontSize\":36,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SUMMER BOOTCAMP\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_9xovdk3e\",\"originX\":\"left\",\"originY\":\"top\",\"left\":770,\"top\":640,\"width\":400,\"fill\":\"#d9f99d\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"• 12 Intense HIIT Workouts\\n• Personal Diet Mapping\\n• 1-on-1 Trainer Access\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_1ino7lji\",\"originX\":\"left\",\"originY\":\"top\",\"left\":580,\"top\":840,\"width\":240,\"height\":52,\"fill\":\"#84cc16\",\"rx\":10,\"ry\":10,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_n4g9llat\",\"originX\":\"center\",\"originY\":\"top\",\"left\":700,\"top\":855,\"width\":240,\"fill\":\"#000000\",\"fontSize\":18,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SIGN UP\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_qt69mzwb",
  "name": "✨ IG Minimal Corporate Agency",
  "category": "Business & Corporate",
  "thumbnail": "#f8fafc",
  "width": 1080,
  "height": 1080,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_qwe9y301\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#f8fafc\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_9vu4lyep\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":960,\"height\":960,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#cbd5e1\",\"strokeWidth\":1},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_jeyerugd\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":120,\"width\":400,\"fill\":\"#0f172a\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"CREATIVE STUDIOS\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_3r12y0yz\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":220,\"width\":440,\"height\":640,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_1j4dhrbd\",\"originX\":\"left\",\"originY\":\"top\",\"left\":135,\"top\":525,\"width\":410,\"fill\":\"#64748b\",\"fontSize\":22,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Case Study Video\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_7ytj32k8\",\"originX\":\"left\",\"originY\":\"top\",\"left\":800,\"top\":300,\"width\":440,\"fill\":\"#0f172a\",\"fontSize\":42,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WE GENERATE ELEVATED SOLUTIONS FOR SaaS BRANDS\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_7uo7ztv2\",\"originX\":\"left\",\"originY\":\"top\",\"left\":800,\"top\":520,\"width\":440,\"fill\":\"#64748b\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Building beautiful custom graphical platforms matching global guidelines.\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_ko89l0lf\",\"originX\":\"left\",\"originY\":\"top\",\"left\":580,\"top\":720,\"width\":220,\"height\":52,\"fill\":\"#0f172a\",\"rx\":8,\"ry\":8,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_wh0vg48r\",\"originX\":\"center\",\"originY\":\"top\",\"left\":690,\"top\":735,\"width\":220,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WORK WITH US\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_wh4het46",
  "name": "✨ IG Cozy Coffee Spot",
  "category": "Food & Restaurant",
  "thumbnail": "#fef3c7",
  "width": 1080,
  "height": 1080,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_rvdvf0wu\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#fef3c7\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_prfpku4y\",\"originX\":\"left\",\"originY\":\"top\",\"left\":80,\"top\":80,\"width\":920,\"height\":920,\"fill\":\"transparent\",\"rx\":18,\"ry\":18,\"selectable\":true,\"evented\":true,\"stroke\":\"#d97706\",\"strokeWidth\":2,\"strokeDashArray\":[6,6]},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_v7sotk21\",\"originX\":\"left\",\"originY\":\"top\",\"left\":140,\"top\":140,\"width\":380,\"height\":800,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_hc16zazj\",\"originX\":\"left\",\"originY\":\"top\",\"left\":155,\"top\":525,\"width\":350,\"fill\":\"#64748b\",\"fontSize\":19,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Latte Cup flatlay\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_5f2vur75\",\"originX\":\"left\",\"originY\":\"top\",\"left\":720,\"top\":240,\"width\":440,\"fill\":\"#78350f\",\"fontSize\":48,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"MORNING ROASTS\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_i7jweunf\",\"originX\":\"left\",\"originY\":\"top\",\"left\":720,\"top\":360,\"width\":440,\"fill\":\"#92400e\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Escape the cold and wrap your hands around our signature vanilla bean latte brewed at precise temperatures.\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_3bee9ncl\",\"originX\":\"left\",\"originY\":\"top\",\"left\":500,\"top\":600,\"width\":200,\"height\":52,\"fill\":\"#d97706\",\"rx\":10,\"ry\":10,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_mrafmel7\",\"originX\":\"center\",\"originY\":\"top\",\"left\":600,\"top\":615,\"width\":200,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"VISIT CAFE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_r3cdt2k7",
  "name": "✨ IG Healthy Salad Recipe",
  "category": "Food & Restaurant",
  "thumbnail": "#f0fdf4",
  "width": 1080,
  "height": 1080,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_swiruu1s\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#f0fdf4\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_zcz428sd\",\"originX\":\"left\",\"originY\":\"top\",\"left\":900,\"top\":200,\"radius\":160,\"fill\":\"rgba(16, 185, 129, 0.15)\",\"opacity\":0.3,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_krdseemg\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":100,\"width\":500,\"height\":880,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_2xpy8cxm\",\"originX\":\"left\",\"originY\":\"top\",\"left\":115,\"top\":525,\"width\":470,\"fill\":\"#64748b\",\"fontSize\":25,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Fresh Salad Platter\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_ie8xmq6k\",\"originX\":\"left\",\"originY\":\"top\",\"left\":640,\"top\":240,\"width\":340,\"height\":440,\"fill\":\"#ffffff\",\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_9vrhzqyo\",\"originX\":\"center\",\"originY\":\"top\",\"left\":810,\"top\":300,\"width\":300,\"fill\":\"#064e3b\",\"fontSize\":38,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SUPERFOOD\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_lxan7kuc\",\"originX\":\"center\",\"originY\":\"top\",\"left\":810,\"top\":360,\"width\":300,\"fill\":\"#10b981\",\"fontSize\":38,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"GREEN SALAD\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_8dctoiah\",\"originX\":\"center\",\"originY\":\"top\",\"left\":810,\"top\":460,\"width\":300,\"fill\":\"#374151\",\"fontSize\":18,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Easy 10-Minute Meal\\nLoaded with Nutrients\\nVegan Friendly\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_zkkrq7jh\",\"originX\":\"left\",\"originY\":\"top\",\"left\":690,\"top\":760,\"width\":240,\"height\":52,\"fill\":\"#10b981\",\"rx\":12,\"ry\":12,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_dcsj3w0f\",\"originX\":\"center\",\"originY\":\"top\",\"left\":810,\"top\":775,\"width\":240,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"GET RECIPE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_u6s0yoee",
  "name": "✨ IG Cyberpunk Fashion",
  "category": "Fashion & Beauty",
  "thumbnail": "#030712",
  "width": 1080,
  "height": 1080,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_808v243o\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#030712\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_cc23qc9o\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":150,\"radius\":100,\"fill\":\"rgba(244, 63, 94, 0.2)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_rw6j67s7\",\"originX\":\"left\",\"originY\":\"top\",\"left\":900,\"top\":950,\"radius\":140,\"fill\":\"rgba(6, 182, 212, 0.2)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_an4qszgg\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":100,\"width\":880,\"height\":540,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_2a272o3x\",\"originX\":\"left\",\"originY\":\"top\",\"left\":115,\"top\":355,\"width\":850,\"fill\":\"#64748b\",\"fontSize\":27,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Cyberpunk Neon Model\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_cwsf2zs6\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":680,\"width\":880,\"height\":300,\"fill\":\"rgba(255, 255, 255, 0.03)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true,\"stroke\":\"rgba(6, 182, 212, 0.3)\",\"strokeWidth\":1},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_v9zdyxo3\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":720,\"width\":800,\"fill\":\"#f43f5e\",\"fontSize\":58,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"NEON ECLIPSE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ipp1k6k5\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":790,\"width\":800,\"fill\":\"#06b6d4\",\"fontSize\":20,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"FUTURISTIC streetwear drop. Available online.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_he71cpxe\",\"originX\":\"left\",\"originY\":\"top\",\"left\":390,\"top\":860,\"width\":300,\"height\":52,\"fill\":\"#06b6d4\",\"rx\":12,\"ry\":12,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_64djao3t\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":875,\"width\":300,\"fill\":\"#030712\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"ORDER NOW\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_v7zfbd2f",
  "name": "✨ IG Minimal Line Art",
  "category": "Social Media",
  "thumbnail": "#fafafa",
  "width": 1080,
  "height": 1080,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_2zkh38xa\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#fafafa\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_n4m1knxm\",\"originX\":\"left\",\"originY\":\"top\",\"left\":40,\"top\":40,\"width\":1000,\"height\":1000,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#27272a\",\"strokeWidth\":2},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_8nt8ht3d\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":100,\"width\":420,\"height\":880,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_ts622rgj\",\"originX\":\"left\",\"originY\":\"top\",\"left\":115,\"top\":525,\"width\":390,\"fill\":\"#64748b\",\"fontSize\":21,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Minimal Line Illustration\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_kbyzfy4s\",\"originX\":\"center\",\"originY\":\"top\",\"left\":760,\"top\":280,\"width\":400,\"fill\":\"#27272a\",\"fontSize\":42,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"EXHIBIT\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_it27mvdk\",\"originX\":\"center\",\"originY\":\"top\",\"left\":760,\"top\":350,\"width\":400,\"fill\":\"#71717a\",\"fontSize\":32,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"AUTUMN IN PARIS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_c9ctslv6\",\"originX\":\"left\",\"originY\":\"top\",\"left\":610,\"top\":460,\"width\":300,\"height\":1,\"fill\":\"#d4d4d8\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_qzrnjoe3\",\"originX\":\"center\",\"originY\":\"top\",\"left\":760,\"top\":520,\"width\":360,\"fill\":\"#a1a1aa\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Modern illustrations capturing timeless architecture.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_xqk9rm0g\",\"originX\":\"left\",\"originY\":\"top\",\"left\":645,\"top\":720,\"width\":230,\"height\":52,\"fill\":\"#27272a\",\"rx\":6,\"ry\":6,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_v1aw3p6p\",\"originX\":\"center\",\"originY\":\"top\",\"left\":760,\"top\":735,\"width\":230,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"BOOK TICKETS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_wuswwuzg",
  "name": "✨ FB Special Product Announcement",
  "category": "Event & Announcement",
  "thumbnail": "#1e1b4b",
  "width": 1200,
  "height": 630,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_gp61lk1h\",\"left\":0,\"top\":0,\"width\":1200,\"height\":630,\"fill\":\"#1e1b4b\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_zpd8xe5i\",\"originX\":\"left\",\"originY\":\"top\",\"left\":1000,\"top\":150,\"radius\":150,\"fill\":\"rgba(251, 191, 36, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_hfkmj1v8\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":500,\"height\":510,\"fill\":\"rgba(255,255,255,0.04)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_79u02kaw\",\"originX\":\"center\",\"originY\":\"top\",\"left\":310,\"top\":120,\"width\":420,\"fill\":\"#fbbf24\",\"fontSize\":36,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"PRODUCT REVEAL\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_cczbv76p\",\"originX\":\"center\",\"originY\":\"top\",\"left\":310,\"top\":200,\"width\":420,\"fill\":\"#ffffff\",\"fontSize\":52,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"NEXT GEN\\nSOCIAL AUTO\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_iikgq1cs\",\"originX\":\"center\",\"originY\":\"top\",\"left\":310,\"top\":360,\"width\":420,\"fill\":\"#c7d2fe\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"AI workflow scheduling live today.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_p9uomz53\",\"originX\":\"left\",\"originY\":\"top\",\"left\":110,\"top\":450,\"width\":200,\"height\":52,\"fill\":\"#fbbf24\",\"rx\":12,\"ry\":12,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_w3wakn2n\",\"originX\":\"center\",\"originY\":\"top\",\"left\":210,\"top\":465,\"width\":200,\"fill\":\"#1e1b4b\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"LEARN MORE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_6hr7ze61\",\"originX\":\"left\",\"originY\":\"top\",\"left\":600,\"top\":60,\"width\":540,\"height\":510,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_km1s56zu\",\"originX\":\"left\",\"originY\":\"top\",\"left\":615,\"top\":300,\"width\":510,\"fill\":\"#64748b\",\"fontSize\":26,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Platform Interface\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_qhtam4cc",
  "name": "✨ FB Holiday Countdown",
  "category": "Event & Announcement",
  "thumbnail": "#451a03",
  "width": 1200,
  "height": 630,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_w81eqcvu\",\"left\":0,\"top\":0,\"width\":1200,\"height\":630,\"fill\":{\"type\":\"linear\",\"coords\":{\"x1\":0,\"y1\":0,\"x2\":1200,\"y2\":630},\"colorStops\":[{\"offset\":0,\"color\":\"#451a03\"},{\"offset\":1,\"color\":\"#9a3412\"}]},\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_9lt2ptua\",\"originX\":\"left\",\"originY\":\"top\",\"left\":200,\"top\":450,\"radius\":100,\"fill\":\"rgba(255,255,255,0.1)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_99ujdcs7\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":600,\"height\":510,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_oddjtg4d\",\"originX\":\"left\",\"originY\":\"top\",\"left\":75,\"top\":300,\"width\":570,\"fill\":\"#64748b\",\"fontSize\":26,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Cozy Fireplace flatlay\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_nwf0y82n\",\"originX\":\"left\",\"originY\":\"top\",\"left\":700,\"top\":60,\"width\":440,\"height\":510,\"fill\":\"#ffffff\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_h2le2g9h\",\"originX\":\"center\",\"originY\":\"top\",\"left\":920,\"top\":140,\"width\":380,\"fill\":\"#ea580c\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"HOLIDAY COUNTDOWN\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_akli928c\",\"originX\":\"center\",\"originY\":\"top\",\"left\":920,\"top\":200,\"width\":380,\"fill\":\"#451a03\",\"fontSize\":44,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"GET READY\\nFOR WINTER\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_2vr5ov08\",\"originX\":\"center\",\"originY\":\"top\",\"left\":920,\"top\":360,\"width\":380,\"fill\":\"#78350f\",\"fontSize\":18,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Unlock 25 days of exclusive warm recipes and cozy gifts.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_f0vdg5xv\",\"originX\":\"left\",\"originY\":\"top\",\"left\":790,\"top\":450,\"width\":260,\"height\":52,\"fill\":\"#ea580c\",\"rx\":14,\"ry\":14,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_6yvrzfj9\",\"originX\":\"center\",\"originY\":\"top\",\"left\":920,\"top\":466,\"width\":260,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"REVEAL DAY 1\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_u1kbbj0f",
  "name": "✨ IG Story Flash Sale",
  "category": "E-commerce & Sale",
  "thumbnail": "#ff006e",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_84jpp9zq\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":\"#ff006e\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_mc9dj09f\",\"originX\":\"left\",\"originY\":\"top\",\"left\":50,\"top\":50,\"width\":980,\"height\":1820,\"fill\":\"transparent\",\"rx\":30,\"ry\":30,\"selectable\":true,\"evented\":true,\"stroke\":\"#ffffff\",\"strokeWidth\":4},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_el6f7vg5\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":160,\"width\":880,\"fill\":\"#ffffff\",\"fontSize\":78,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"FLASH SALE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_pdd1jpyc\",\"originX\":\"left\",\"originY\":\"top\",\"left\":340,\"top\":280,\"width\":400,\"height\":60,\"fill\":\"#ffffff\",\"rx\":15,\"ry\":15,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_o4husruo\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":298,\"width\":400,\"fill\":\"#ff006e\",\"fontSize\":20,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"LIMITED TIME ONLY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_l21jredr\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":400,\"width\":840,\"height\":840,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":34,\"ry\":34,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_9429mz4a\",\"originX\":\"left\",\"originY\":\"top\",\"left\":135,\"top\":805,\"width\":810,\"fill\":\"#64748b\",\"fontSize\":42,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Product Showcase\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_b8hze0fg\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1340,\"width\":880,\"fill\":\"#ffffff\",\"fontSize\":48,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"UP TO 70% OFF SITEWIDE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_shqahrp9\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1420,\"width\":880,\"fill\":\"rgba(255,255,255,0.85)\",\"fontSize\":24,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Use code: FLASH70 at checkout.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_4868r9xn\",\"originX\":\"left\",\"originY\":\"top\",\"left\":290,\"top\":1600,\"width\":500,\"height\":68,\"fill\":\"#FFD700\",\"rx\":16,\"ry\":16,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_udxugbbj\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1620,\"width\":500,\"fill\":\"#ff006e\",\"fontSize\":22,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SHOP DEALS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_umxvqke7",
  "name": "✨ IG Story Modern Workout",
  "category": "Fitness & Health",
  "thumbnail": "#09090b",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_pc85ilfc\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":\"#09090b\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_gkqah7dz\",\"originX\":\"left\",\"originY\":\"top\",\"left\":900,\"top\":200,\"radius\":140,\"fill\":\"rgba(6, 182, 212, 0.2)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_00zostih\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":140,\"width\":880,\"fill\":\"#06b6d4\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"DAY 05: FULL BODY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_pppba1p7\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":190,\"width\":880,\"fill\":\"#ffffff\",\"fontSize\":48,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"HYBRID ATHLETE WORKOUT\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_z3wryemf\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":300,\"width\":880,\"height\":880,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_n05oiytj\",\"originX\":\"left\",\"originY\":\"top\",\"left\":115,\"top\":725,\"width\":850,\"fill\":\"#64748b\",\"fontSize\":44,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Coach doing Deadlift\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_4427hb9o\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":1240,\"width\":880,\"height\":380,\"fill\":\"rgba(255, 255, 255, 0.03)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_jptclhau\",\"originX\":\"left\",\"originY\":\"top\",\"left\":280,\"top\":1280,\"width\":400,\"fill\":\"#06b6d4\",\"fontSize\":24,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"TODAYS TARGETS:\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_pazwghfm\",\"originX\":\"left\",\"originY\":\"top\",\"left\":160,\"top\":1340,\"width\":760,\"fill\":\"#a1a1aa\",\"fontSize\":22,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"1. Back Squats: 4 Sets x 8 Reps\\n2. Weighted Pull-ups: 3 Sets x 10 Reps\\n3. Assault Bike Sprints: 10 Mins HIIT\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_khudv3l6\",\"originX\":\"left\",\"originY\":\"top\",\"left\":340,\"top\":1680,\"width\":400,\"height\":60,\"fill\":\"#06b6d4\",\"rx\":12,\"ry\":12,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_jl5evbze\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1698,\"width\":400,\"fill\":\"#09090b\",\"fontSize\":18,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SWIPE FOR VIDEO\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_4vn8drji",
  "name": "✨ IG Story Travel Diary",
  "category": "Travel & Lifestyle",
  "thumbnail": "#f1f5f9",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_6tqgmpwl\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":\"#f1f5f9\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_f0tkhwig\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":1400,\"radius\":120,\"fill\":\"rgba(99, 102, 241, 0.12)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ayu2cyun\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":140,\"width\":800,\"fill\":\"#475569\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WANDERLUST VLOG\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_fc4vj2xh\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":190,\"width\":800,\"fill\":\"#0f172a\",\"fontSize\":64,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"EXPLORING BALI\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_xi0ctjcu\",\"originX\":\"left\",\"originY\":\"top\",\"left\":140,\"top\":320,\"width\":800,\"height\":1100,\"fill\":\"#ffffff\",\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true,\"stroke\":\"rgba(0,0,0,0.05)\",\"strokeWidth\":3},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_vbh5qk5o\",\"originX\":\"left\",\"originY\":\"top\",\"left\":190,\"top\":370,\"width\":700,\"height\":800,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":18,\"ry\":18,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_wwifekaj\",\"originX\":\"left\",\"originY\":\"top\",\"left\":205,\"top\":755,\"width\":670,\"fill\":\"#64748b\",\"fontSize\":35,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Bali Sunset Beach\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_po0cp8h7\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1230,\"width\":700,\"fill\":\"#334155\",\"fontSize\":26,\"fontWeight\":\"700\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"\\\"Sunset is the ultimate golden hour.\\\"\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_bsy82v8m\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1290,\"width\":700,\"fill\":\"#64748b\",\"fontSize\":20,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📍 Seminyak Coast\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_wb4eki3o\",\"originX\":\"left\",\"originY\":\"top\",\"left\":290,\"top\":1650,\"width\":500,\"height\":60,\"fill\":\"#0f172a\",\"rx\":14,\"ry\":14,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_5rzura9v\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1668,\"width\":500,\"fill\":\"#ffffff\",\"fontSize\":18,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WATCH TRAVEL VLOG\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_2nudohhk",
  "name": "✨ IG Story Fashion Lookbook",
  "category": "Fashion & Beauty",
  "thumbnail": "#fdf4ff",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_a9pq4kfv\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":\"#fdf4ff\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_0m1zbel2\",\"originX\":\"left\",\"originY\":\"top\",\"left\":40,\"top\":40,\"width\":1000,\"height\":1840,\"fill\":\"transparent\",\"rx\":22,\"ry\":22,\"selectable\":true,\"evented\":true,\"stroke\":\"#f472b6\",\"strokeWidth\":1},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_a4gncq26\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":120,\"width\":800,\"fill\":\"#f472b6\",\"fontSize\":24,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SUMMER APPAREL\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_fvg351np\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":160,\"width\":800,\"fill\":\"#4a044e\",\"fontSize\":52,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"VINTAGE CHIC LOOK\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_73zfdt38\",\"originX\":\"left\",\"originY\":\"top\",\"left\":140,\"top\":270,\"width\":380,\"height\":1000,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_s0t8wwcl\",\"originX\":\"left\",\"originY\":\"top\",\"left\":155,\"top\":755,\"width\":350,\"fill\":\"#64748b\",\"fontSize\":19,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Full Length Model\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_yn3a407d\",\"originX\":\"left\",\"originY\":\"top\",\"left\":560,\"top\":270,\"width\":380,\"height\":480,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_i3c9f6sk\",\"originX\":\"left\",\"originY\":\"top\",\"left\":575,\"top\":495,\"width\":350,\"fill\":\"#64748b\",\"fontSize\":19,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Detail Shot 1\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_bv0yf9en\",\"originX\":\"left\",\"originY\":\"top\",\"left\":560,\"top\":790,\"width\":380,\"height\":480,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_7u8444ca\",\"originX\":\"left\",\"originY\":\"top\",\"left\":575,\"top\":1015,\"width\":350,\"fill\":\"#64748b\",\"fontSize\":19,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Detail Shot 2\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_85f8z4uu\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1370,\"width\":800,\"fill\":\"#701a75\",\"fontSize\":22,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Earthy tones & natural linen fits.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_7plqfbfa\",\"originX\":\"left\",\"originY\":\"top\",\"left\":290,\"top\":1620,\"width\":500,\"height\":60,\"fill\":\"#4a044e\",\"rx\":8,\"ry\":8,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_mnzfhe8q\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1638,\"width\":500,\"fill\":\"#ffffff\",\"fontSize\":18,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SHOP COLLECTION\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_gd5u8y0i",
  "name": "✨ TT Behind The Scenes",
  "category": "Social Media",
  "thumbnail": "#312e81",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_bz0v6xa0\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":{\"type\":\"linear\",\"coords\":{\"x1\":0,\"y1\":0,\"x2\":1080,\"y2\":1920},\"colorStops\":[{\"offset\":0,\"color\":\"#312e81\"},{\"offset\":1,\"color\":\"#1e1b4b\"}]},\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_uh97xb8f\",\"originX\":\"left\",\"originY\":\"top\",\"left\":850,\"top\":1650,\"radius\":150,\"fill\":\"rgba(236, 72, 153, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_c8882dbu\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":150,\"width\":880,\"fill\":\"#ec4899\",\"fontSize\":26,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"PIXASOCIAL LABS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ypu8tk4n\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":200,\"width\":880,\"fill\":\"#ffffff\",\"fontSize\":58,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"BEHIND THE SCENES\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_vr2bwgj8\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":320,\"width\":880,\"height\":1140,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":32,\"ry\":32,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_uaaxh7mh\",\"originX\":\"left\",\"originY\":\"top\",\"left\":115,\"top\":875,\"width\":850,\"fill\":\"#64748b\",\"fontSize\":44,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Studio Setup Video\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_kw56ygj4\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1530,\"width\":800,\"fill\":\"#cbd5e1\",\"fontSize\":22,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Unlocking the setup of our graphical editor pipeline.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_8prcqaea\",\"originX\":\"left\",\"originY\":\"top\",\"left\":340,\"top\":1680,\"width\":400,\"height\":64,\"fill\":\"#ec4899\",\"rx\":16,\"ry\":16,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_wiskfygf\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1700,\"width\":400,\"fill\":\"#ffffff\",\"fontSize\":18,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WATCH PART 1\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_d7plen2c",
  "name": "✨ TT Beauty Secrets",
  "category": "Fashion & Beauty",
  "thumbnail": "#ffffff",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_kszjvg8q\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":\"#ffffff\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_rv0n2uk0\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":960,\"height\":1800,\"fill\":\"transparent\",\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true,\"stroke\":\"#f472b6\",\"strokeWidth\":2,\"strokeDashArray\":[8,8]},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_g4os1f0d\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":150,\"width\":800,\"fill\":\"#f472b6\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"GLOW SKIN ROUTINE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_kp3hyl5a\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":200,\"width\":800,\"fill\":\"#4a044e\",\"fontSize\":58,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"5 BEAUTY SECRETS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_p5ahr6wg\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":320,\"width\":840,\"height\":840,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_wntmahaj\",\"originX\":\"left\",\"originY\":\"top\",\"left\":135,\"top\":725,\"width\":810,\"fill\":\"#64748b\",\"fontSize\":42,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Cleansing Routine\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_al2xunzm\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":1220,\"width\":840,\"height\":340,\"fill\":\"#fdf4ff\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_btb0vi8l\",\"originX\":\"left\",\"originY\":\"top\",\"left\":280,\"top\":1260,\"width\":400,\"fill\":\"#f472b6\",\"fontSize\":22,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"TIP OF THE DAY:\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_uexmuo9w\",\"originX\":\"left\",\"originY\":\"top\",\"left\":210,\"top\":1315,\"width\":660,\"fill\":\"#701a75\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Apply premium organic serums while skin is damp to trap hydration deeply within structural layers.\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_ozv1029f\",\"originX\":\"left\",\"originY\":\"top\",\"left\":340,\"top\":1680,\"width\":400,\"height\":60,\"fill\":\"#4a044e\",\"rx\":12,\"ry\":12,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_pxpczi9n\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1698,\"width\":400,\"fill\":\"#ffffff\",\"fontSize\":18,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"FOLLOW FOR TIPS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_m7rql6cj",
  "name": "✨ TT Daily Quote Card",
  "category": "Motivational & Quotes",
  "thumbnail": "#0f2027",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_gj2hq5nd\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":{\"type\":\"linear\",\"coords\":{\"x1\":0,\"y1\":0,\"x2\":1080,\"y2\":1920},\"colorStops\":[{\"offset\":0,\"color\":\"#0f2027\"},{\"offset\":1,\"color\":\"#2c5364\"}]},\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_bd8tj03p\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":300,\"radius\":120,\"fill\":\"rgba(168, 218, 220, 0.1)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_qxwcndin\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":250,\"width\":880,\"height\":1420,\"fill\":\"rgba(255,255,255,0.04)\",\"rx\":30,\"ry\":30,\"selectable\":true,\"evented\":true,\"stroke\":\"rgba(255,255,255,0.06)\",\"strokeWidth\":1},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ns5sq9y7\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":350,\"width\":700,\"fill\":\"#a8dadc\",\"fontSize\":26,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"DAILY WISDOM\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_a346u9wc\",\"originX\":\"left\",\"originY\":\"top\",\"left\":440,\"top\":440,\"width\":200,\"height\":2,\"fill\":\"rgba(255,255,255,0.2)\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_sn6kjcwb\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":520,\"width\":700,\"fill\":\"#a8dadc\",\"fontSize\":160,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"“\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ghslk6wk\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":680,\"width\":740,\"fill\":\"#ffffff\",\"fontSize\":44,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"YOUR ATTENTION IS\\nTHE MOST VALUABLE\\nASSET YOU OWN.\\nINVEST IT WISELY.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_7roex5u1\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":940,\"width\":700,\"fill\":\"rgba(255,255,255,0.7)\",\"fontSize\":22,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Control your focus to control your future.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_tx5lfclt\",\"originX\":\"left\",\"originY\":\"top\",\"left\":240,\"top\":1100,\"width\":600,\"height\":420,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_kj6w6pdl\",\"originX\":\"left\",\"originY\":\"top\",\"left\":255,\"top\":1295,\"width\":570,\"fill\":\"#64748b\",\"fontSize\":21,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Peaceful Nature flatlay\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_ajwq8df2",
  "name": "✨ TT Podcast Spotlight",
  "category": "Travel & Lifestyle",
  "thumbnail": "#09090b",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_3itz2ias\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":\"#09090b\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_tan8h5lx\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":960,\"height\":1800,\"fill\":\"#18181b\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_6cpvpblp\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":150,\"width\":800,\"fill\":\"#d4af37\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"THE FOUNDER LAB\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_3a5bvsrn\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":200,\"width\":800,\"fill\":\"#ffffff\",\"fontSize\":46,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"EPISODE 88 INTERVIEW\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_di49fz48\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":320,\"width\":840,\"height\":840,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_8nk3gzpc\",\"originX\":\"left\",\"originY\":\"top\",\"left\":135,\"top\":725,\"width\":810,\"fill\":\"#64748b\",\"fontSize\":42,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Founder Speaking Video\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_hx6jwp2c\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1260,\"width\":720,\"fill\":\"#fafaf9\",\"fontSize\":26,\"fontWeight\":\"700\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"\\\"Building a 7-figure brand requires zero magic, just high-contrast precision execution of core parameters daily.\\\"\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ohaulwgi\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1420,\"width\":720,\"fill\":\"#a1a1aa\",\"fontSize\":20,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Featuring John Bliss, SmmtAI\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_hvmfjdnn\",\"originX\":\"left\",\"originY\":\"top\",\"left\":340,\"top\":1650,\"width\":400,\"height\":60,\"fill\":\"#d4af37\",\"rx\":10,\"ry\":10,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_crqbieq5\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1668,\"width\":400,\"fill\":\"#09090b\",\"fontSize\":18,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"LISTEN TO EPISODE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_4k9hwgk9",
  "name": "✨ TT Q&A Session Card",
  "category": "Social Media",
  "thumbnail": "#fef3c7",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_k1j6ma9d\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":\"#fef3c7\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_8npgm3tm\",\"originX\":\"left\",\"originY\":\"top\",\"left\":900,\"top\":250,\"radius\":100,\"fill\":\"rgba(217, 119, 6, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_4egay6v2\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":160,\"width\":800,\"fill\":\"#d97706\",\"fontSize\":26,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"INTERACTIVE SUITE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_cb0ov5ko\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":210,\"width\":800,\"fill\":\"#78350f\",\"fontSize\":54,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"ASK ME ANYTHING!\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_tqnlbubz\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":350,\"width\":840,\"height\":540,\"fill\":\"#ffffff\",\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true,\"stroke\":\"rgba(120, 53, 15, 0.1)\",\"strokeWidth\":1},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_rjf7g1v3\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":460,\"width\":720,\"fill\":\"#92400e\",\"fontSize\":26,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Send your questions about social automation & SaaS startup scaling.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_ytvs0lci\",\"originX\":\"left\",\"originY\":\"top\",\"left\":290,\"top\":680,\"width\":500,\"height\":52,\"fill\":\"#d97706\",\"rx\":12,\"ry\":12,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_m9tjgu2b\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":696,\"width\":500,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"TAP TO TYPE QUESTION\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_s9v86wva\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":980,\"width\":840,\"height\":720,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_dl9v11u5\",\"originX\":\"left\",\"originY\":\"top\",\"left\":135,\"top\":1325,\"width\":810,\"fill\":\"#64748b\",\"fontSize\":36,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Workspace setup\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_t46xau4i",
  "name": "✨ IG Story Minimalist Frame",
  "category": "Social Media",
  "thumbnail": "#fafafa",
  "width": 1080,
  "height": 1920,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_oghiu38o\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1920,\"fill\":\"#fafafa\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_xvvodq8w\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":960,\"height\":1800,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#27272a\",\"strokeWidth\":2},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_k3kxufq0\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":180,\"width\":800,\"fill\":\"#27272a\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"MINIMALIST DESIGN\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_jsjij674\",\"originX\":\"left\",\"originY\":\"top\",\"left\":140,\"top\":300,\"width\":800,\"height\":1100,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_o6xot2x5\",\"originX\":\"left\",\"originY\":\"top\",\"left\":155,\"top\":835,\"width\":770,\"fill\":\"#64748b\",\"fontSize\":40,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Fine Line Architecture Illust\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_n5ohimaq\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1480,\"width\":800,\"fill\":\"#27272a\",\"fontSize\":36,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"ELEVATING THE VIBE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_bep9lrfh\",\"originX\":\"center\",\"originY\":\"top\",\"left\":540,\"top\":1540,\"width\":800,\"fill\":\"#71717a\",\"fontSize\":20,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Captured by PixaSocial Gallery\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_3tt412go",
  "name": "✨ YT Epic Gaming Layout",
  "category": "Social Media",
  "thumbnail": "#030712",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_mg04kboo\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":{\"type\":\"linear\",\"coords\":{\"x1\":0,\"y1\":0,\"x2\":1280,\"y2\":720},\"colorStops\":[{\"offset\":0,\"color\":\"#030712\"},{\"offset\":1,\"color\":\"#0f172a\"}]},\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_u4h1tpav\",\"originX\":\"left\",\"originY\":\"top\",\"left\":180,\"top\":540,\"radius\":140,\"fill\":\"rgba(244, 63, 94, 0.2)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_8g5e2qvn\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":620,\"height\":600,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_39xks7hk\",\"originX\":\"left\",\"originY\":\"top\",\"left\":75,\"top\":345,\"width\":590,\"fill\":\"#64748b\",\"fontSize\":30,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Game Console / Action\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_tz0g7zs4\",\"originX\":\"left\",\"originY\":\"top\",\"left\":710,\"top\":60,\"width\":510,\"height\":600,\"fill\":\"rgba(255,255,255,0.03)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true,\"stroke\":\"rgba(244,63,94,0.3)\",\"strokeWidth\":1},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_a1yhzlen\",\"originX\":\"center\",\"originY\":\"top\",\"left\":965,\"top\":180,\"width\":450,\"fill\":\"#f43f5e\",\"fontSize\":64,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"EPIC FIGHT\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_eibxhxx5\",\"originX\":\"center\",\"originY\":\"top\",\"left\":965,\"top\":270,\"width\":450,\"fill\":\"#ffffff\",\"fontSize\":48,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"HOW TO WIN\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_e6xxb98e\",\"originX\":\"center\",\"originY\":\"top\",\"left\":965,\"top\":360,\"width\":450,\"fill\":\"#06b6d4\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"PRO LEVEL GUIDE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_nms5cgsg\",\"originX\":\"left\",\"originY\":\"top\",\"left\":795,\"top\":480,\"width\":340,\"height\":56,\"fill\":\"#f43f5e\",\"rx\":14,\"ry\":14,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_heytzzbs\",\"originX\":\"center\",\"originY\":\"top\",\"left\":965,\"top\":496,\"width\":340,\"fill\":\"#ffffff\",\"fontSize\":18,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WATCH GAMEPLAY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_dnfsowag",
  "name": "✨ YT Step-by-Step Tutorial",
  "category": "Social Media",
  "thumbnail": "#f8fafc",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_uchipzp6\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":\"#f8fafc\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_k0le517z\",\"originX\":\"left\",\"originY\":\"top\",\"left\":40,\"top\":40,\"width\":1200,\"height\":640,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#cbd5e1\",\"strokeWidth\":1},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_57sfzu2g\",\"originX\":\"left\",\"originY\":\"top\",\"left\":335,\"top\":140,\"width\":550,\"fill\":\"#3b82f6\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"VITE REACT\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_mc1o50l6\",\"originX\":\"left\",\"originY\":\"top\",\"left\":335,\"top\":200,\"width\":550,\"fill\":\"#0f172a\",\"fontSize\":52,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"BUILD AND DEPLOY\\nA WEB APP IN 16S\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_m4v513eh\",\"originX\":\"left\",\"originY\":\"top\",\"left\":335,\"top\":360,\"width\":550,\"fill\":\"#64748b\",\"fontSize\":22,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Clean frontend compilation guide.\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_1tcpqnun\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":450,\"width\":200,\"height\":52,\"fill\":\"#3b82f6\",\"rx\":10,\"ry\":10,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_7z8qsx2f\",\"originX\":\"center\",\"originY\":\"top\",\"left\":160,\"top\":465,\"width\":200,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"START GUIDE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_tnu0296a\",\"originX\":\"left\",\"originY\":\"top\",\"left\":660,\"top\":60,\"width\":560,\"height\":600,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_mmavch46\",\"originX\":\"left\",\"originY\":\"top\",\"left\":675,\"top\":345,\"width\":530,\"fill\":\"#64748b\",\"fontSize\":28,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Code IDE Editor View\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_nqc1yxhy",
  "name": "✨ YT Product Review Slate",
  "category": "Tech & SaaS",
  "thumbnail": "#09090b",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_a14kb714\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":\"#09090b\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_7uklt1ou\",\"originX\":\"left\",\"originY\":\"top\",\"left\":50,\"top\":50,\"width\":1180,\"height\":620,\"fill\":\"transparent\",\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true,\"stroke\":\"rgba(255,255,255,0.06)\",\"strokeWidth\":2},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_852f1icq\",\"originX\":\"left\",\"originY\":\"top\",\"left\":100,\"top\":100,\"width\":540,\"height\":520,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_u548psr4\",\"originX\":\"left\",\"originY\":\"top\",\"left\":115,\"top\":345,\"width\":510,\"fill\":\"#64748b\",\"fontSize\":26,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Smartphone close-up\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_lgyaqn0w\",\"originX\":\"center\",\"originY\":\"top\",\"left\":930,\"top\":180,\"width\":520,\"fill\":\"#d4af37\",\"fontSize\":32,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SMARTPHONE REVEAL\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_eygo45j2\",\"originX\":\"center\",\"originY\":\"top\",\"left\":930,\"top\":240,\"width\":520,\"fill\":\"#ffffff\",\"fontSize\":54,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"IS IT WORTH IT?\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_meaxhdg8\",\"originX\":\"center\",\"originY\":\"top\",\"left\":930,\"top\":380,\"width\":520,\"fill\":\"#a1a1aa\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"An honest 30-day structural audit of durability and battery metrics.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_5xi99hxs\",\"originX\":\"left\",\"originY\":\"top\",\"left\":670,\"top\":480,\"width\":240,\"height\":52,\"fill\":\"#d4af37\",\"rx\":8,\"ry\":8,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_rjp7ae8u\",\"originX\":\"center\",\"originY\":\"top\",\"left\":790,\"top\":496,\"width\":240,\"fill\":\"#09090b\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SEE THE VERDICT\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_33tmtvku",
  "name": "✨ YT Interview Podcast",
  "category": "Social Media",
  "thumbnail": "#022c22",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_i2wwji5i\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":\"#022c22\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_j6i738rt\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":540,\"radius\":120,\"fill\":\"rgba(217, 119, 6, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_4bqhgkzg\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":540,\"height\":600,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_41gyjp2z\",\"originX\":\"left\",\"originY\":\"top\",\"left\":75,\"top\":345,\"width\":510,\"fill\":\"#64748b\",\"fontSize\":27,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Host Close-up\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_sebl467s\",\"originX\":\"left\",\"originY\":\"top\",\"left\":680,\"top\":60,\"width\":540,\"height\":600,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_piqf7q8e\",\"originX\":\"left\",\"originY\":\"top\",\"left\":695,\"top\":345,\"width\":510,\"fill\":\"#64748b\",\"fontSize\":27,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Guest Close-up\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_inekekx7\",\"originX\":\"left\",\"originY\":\"top\",\"left\":400,\"top\":260,\"width\":480,\"height\":200,\"fill\":\"#ffffff\",\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true,\"stroke\":\"#d97706\",\"strokeWidth\":2},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_vr4garh2\",\"originX\":\"center\",\"originY\":\"top\",\"left\":640,\"top\":300,\"width\":440,\"fill\":\"#d97706\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"THE COFFEE TALKS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_plf717yy\",\"originX\":\"center\",\"originY\":\"top\",\"left\":640,\"top\":350,\"width\":440,\"fill\":\"#022c22\",\"fontSize\":34,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"EPISODE 40: SAAS SCALING\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_uiut3yd6",
  "name": "✨ YT Plated Gourmet Cooking",
  "category": "Food & Restaurant",
  "thumbnail": "#fef3c7",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_nfxozrys\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":\"#fef3c7\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_evq3dn83\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":1160,\"height\":600,\"fill\":\"transparent\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true,\"stroke\":\"#d97706\",\"strokeWidth\":2,\"strokeDashArray\":[10,10]},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_dkap3ek9\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":120,\"width\":480,\"height\":480,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_9qobgabj\",\"originX\":\"left\",\"originY\":\"top\",\"left\":135,\"top\":345,\"width\":450,\"fill\":\"#64748b\",\"fontSize\":24,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Plated Truffle Pasta\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ly1irsf3\",\"originX\":\"center\",\"originY\":\"top\",\"left\":910,\"top\":180,\"width\":500,\"fill\":\"#78350f\",\"fontSize\":58,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"TRUFFLE PASTA\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_s8rd8oe0\",\"originX\":\"center\",\"originY\":\"top\",\"left\":910,\"top\":270,\"width\":500,\"fill\":\"#d97706\",\"fontSize\":32,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"THE PERFECT 15-MIN MEAL\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_hi1zsuxt\",\"originX\":\"center\",\"originY\":\"top\",\"left\":910,\"top\":360,\"width\":500,\"fill\":\"#92400e\",\"fontSize\":18,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Learn to craft a creamy restaurant-level emulsion right in your home kitchen skillet.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_ft654k3c\",\"originX\":\"left\",\"originY\":\"top\",\"left\":670,\"top\":480,\"width\":220,\"height\":52,\"fill\":\"#d97706\",\"rx\":12,\"ry\":12,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_o6mbqotq\",\"originX\":\"center\",\"originY\":\"top\",\"left\":780,\"top\":495,\"width\":220,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"PLAY TUTORIAL\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_o7vh4coj",
  "name": "✨ YT Travel Vlog Sunset",
  "category": "Travel & Lifestyle",
  "thumbnail": "#ad5389",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_zkxi03hx\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":{\"type\":\"linear\",\"coords\":{\"x1\":0,\"y1\":0,\"x2\":1280,\"y2\":720},\"colorStops\":[{\"offset\":0,\"color\":\"#ad5389\"},{\"offset\":1,\"color\":\"#3c1053\"}]},\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_h77v5wqn\",\"originX\":\"left\",\"originY\":\"top\",\"left\":1000,\"top\":150,\"radius\":120,\"fill\":\"rgba(255,255,255,0.1)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_n9agbfw6\",\"originX\":\"left\",\"originY\":\"top\",\"left\":80,\"top\":80,\"width\":640,\"height\":560,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_fuoawq84\",\"originX\":\"left\",\"originY\":\"top\",\"left\":95,\"top\":345,\"width\":610,\"fill\":\"#64748b\",\"fontSize\":28,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Drone shot of Greek Coast\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_xn12fxg0\",\"originX\":\"left\",\"originY\":\"top\",\"left\":760,\"top\":80,\"width\":440,\"height\":560,\"fill\":\"rgba(255,255,255,0.03)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_6mqu4a9f\",\"originX\":\"center\",\"originY\":\"top\",\"left\":980,\"top\":180,\"width\":380,\"fill\":\"#ffffff\",\"fontSize\":34,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"TRAVEL DIARY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_z3buae7u\",\"originX\":\"center\",\"originY\":\"top\",\"left\":980,\"top\":250,\"width\":380,\"fill\":\"#fbbf24\",\"fontSize\":48,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"EXPLORING GREECE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ftqd4gee\",\"originX\":\"center\",\"originY\":\"top\",\"left\":980,\"top\":380,\"width\":380,\"fill\":\"#e2e8f0\",\"fontSize\":18,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Secrets of the Aegean coast flatlands.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_oi180i9p\",\"originX\":\"left\",\"originY\":\"top\",\"left\":830,\"top\":470,\"width\":300,\"height\":52,\"fill\":\"#fbbf24\",\"rx\":12,\"ry\":12,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_2i32qxa6\",\"originX\":\"center\",\"originY\":\"top\",\"left\":980,\"top\":486,\"width\":300,\"fill\":\"#3c1053\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"START JOURNEY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_dus3i04g",
  "name": "✨ YT Financial Analytics",
  "category": "Business & Corporate",
  "thumbnail": "#0f172a",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_lqatc8n4\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":\"#0f172a\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_jzp0swla\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":540,\"height\":600,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_q8fouer2\",\"originX\":\"left\",\"originY\":\"top\",\"left\":75,\"top\":345,\"width\":510,\"fill\":\"#64748b\",\"fontSize\":27,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Trend stock charts\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_wmadut8k\",\"originX\":\"left\",\"originY\":\"top\",\"left\":640,\"top\":60,\"width\":580,\"height\":600,\"fill\":\"rgba(255,255,255,0.04)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_m5knl4oa\",\"originX\":\"center\",\"originY\":\"top\",\"left\":930,\"top\":160,\"width\":520,\"fill\":\"#3b82f6\",\"fontSize\":32,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"MARKET INSIGHTS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_obz57h59\",\"originX\":\"center\",\"originY\":\"top\",\"left\":930,\"top\":220,\"width\":520,\"fill\":\"#ffffff\",\"fontSize\":54,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"FINANCE AUDIT 2026\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ewdgwijz\",\"originX\":\"center\",\"originY\":\"top\",\"left\":930,\"top\":360,\"width\":520,\"fill\":\"#94a3b8\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Mapping macro indicators, seat limits, and regulatory adjustments in trading portfolios.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_7vpgi0kt\",\"originX\":\"left\",\"originY\":\"top\",\"left\":700,\"top\":480,\"width\":260,\"height\":52,\"fill\":\"#3b82f6\",\"rx\":14,\"ry\":14,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_3eo0d2xz\",\"originX\":\"center\",\"originY\":\"top\",\"left\":830,\"top\":495,\"width\":260,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"DECODE MARKETS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_1af5t73u",
  "name": "✨ YT Art Studio Showcase",
  "category": "Social Media",
  "thumbnail": "#ffffff",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_zk4rdm71\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":\"#ffffff\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_zgqwvldk\",\"originX\":\"left\",\"originY\":\"top\",\"left\":40,\"top\":40,\"width\":1200,\"height\":640,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#27272a\",\"strokeWidth\":1},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_4hblu0qv\",\"originX\":\"left\",\"originY\":\"top\",\"left\":80,\"top\":80,\"width\":500,\"height\":560,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_gvbxo3lv\",\"originX\":\"left\",\"originY\":\"top\",\"left\":95,\"top\":345,\"width\":470,\"fill\":\"#64748b\",\"fontSize\":25,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Oil painting close-up\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_3uytmeuj\",\"originX\":\"center\",\"originY\":\"top\",\"left\":930,\"top\":180,\"width\":560,\"fill\":\"#71717a\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"STUDIO GALLERY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_zdcztqc1\",\"originX\":\"center\",\"originY\":\"top\",\"left\":930,\"top\":230,\"width\":560,\"fill\":\"#27272a\",\"fontSize\":56,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SKETCHING SECRETS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_29okl39t\",\"originX\":\"center\",\"originY\":\"top\",\"left\":930,\"top\":370,\"width\":520,\"fill\":\"#a1a1aa\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Unlocking clean geometric structures and soft shading pairing math.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_328vjrv0\",\"originX\":\"left\",\"originY\":\"top\",\"left\":660,\"top\":470,\"width\":220,\"height\":52,\"fill\":\"#27272a\",\"rx\":6,\"ry\":6,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_k2ec9bpj\",\"originX\":\"center\",\"originY\":\"top\",\"left\":770,\"top\":485,\"width\":220,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"ENTER GALLERY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_521prdxf",
  "name": "✨ YT Fitness Vlog Motivation",
  "category": "Fitness & Health",
  "thumbnail": "#000000",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_flyzn360\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":\"#000000\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_3z1eokt2\",\"originX\":\"left\",\"originY\":\"top\",\"left\":0,\"top\":500,\"width\":1280,\"height\":220,\"fill\":\"#84cc16\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_g0pge30i\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":1160,\"height\":400,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_s5a2gvul\",\"originX\":\"left\",\"originY\":\"top\",\"left\":75,\"top\":245,\"width\":1130,\"fill\":\"#64748b\",\"fontSize\":20,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Gym action sequence\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_2cy0hxu6\",\"originX\":\"center\",\"originY\":\"top\",\"left\":640,\"top\":540,\"width\":1100,\"fill\":\"#000000\",\"fontSize\":48,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"HYBRID RUNNING INTENSITY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_mnjgzsyh\",\"originX\":\"center\",\"originY\":\"top\",\"left\":640,\"top\":610,\"width\":1100,\"fill\":\"#451a03\",\"fontSize\":22,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Boost cardiovascular threshold metrics today.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_87nve4by",
  "name": "✨ YT SaaS Software Walkthrough",
  "category": "Tech & SaaS",
  "thumbnail": "#312e81",
  "width": 1280,
  "height": 720,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_w0ba8eoo\",\"left\":0,\"top\":0,\"width\":1280,\"height\":720,\"fill\":{\"type\":\"linear\",\"coords\":{\"x1\":0,\"y1\":0,\"x2\":1280,\"y2\":720},\"colorStops\":[{\"offset\":0,\"color\":\"#312e81\"},{\"offset\":1,\"color\":\"#1e1b4b\"}]},\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_rb8wjhaq\",\"originX\":\"left\",\"originY\":\"top\",\"left\":200,\"top\":200,\"radius\":120,\"fill\":\"rgba(236, 72, 153, 0.12)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_nhyzvx8k\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":660,\"height\":600,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_3t7yvn50\",\"originX\":\"left\",\"originY\":\"top\",\"left\":75,\"top\":345,\"width\":630,\"fill\":\"#64748b\",\"fontSize\":30,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Software Dashboard UI\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_ahu0vsvq\",\"originX\":\"left\",\"originY\":\"top\",\"left\":760,\"top\":60,\"width\":460,\"height\":600,\"fill\":\"rgba(255,255,255,0.03)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_76pmn64c\",\"originX\":\"center\",\"originY\":\"top\",\"left\":990,\"top\":160,\"width\":400,\"fill\":\"#ec4899\",\"fontSize\":32,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SAAS PRODUCTIVITY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_db34bpdq\",\"originX\":\"center\",\"originY\":\"top\",\"left\":990,\"top\":220,\"width\":400,\"fill\":\"#ffffff\",\"fontSize\":54,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WORKFLOW AUTO\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_jcl6susj\",\"originX\":\"center\",\"originY\":\"top\",\"left\":990,\"top\":360,\"width\":400,\"fill\":\"#cbd5e1\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Step-by-step seat limit configuration.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_q6mwka2y\",\"originX\":\"left\",\"originY\":\"top\",\"left\":840,\"top\":480,\"width\":300,\"height\":52,\"fill\":\"#ec4899\",\"rx\":14,\"ry\":14,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_wj6h42r7\",\"originX\":\"center\",\"originY\":\"top\",\"left\":990,\"top\":495,\"width\":300,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WATCH NOW\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_pzfegttr",
  "name": "✨ LI Career Growth Checklist",
  "category": "Business & Corporate",
  "thumbnail": "#0f172a",
  "width": 1200,
  "height": 628,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_8jt27g51\",\"left\":0,\"top\":0,\"width\":1200,\"height\":628,\"fill\":\"#0f172a\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_z0j16f07\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":150,\"radius\":90,\"fill\":\"rgba(59, 130, 246, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_mesikyrd\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":500,\"height\":508,\"fill\":\"rgba(255,255,255,0.03)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ti0vc03p\",\"originX\":\"center\",\"originY\":\"top\",\"left\":310,\"top\":110,\"width\":440,\"fill\":\"#3b82f6\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"EXECUTIVE GROWTH\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_vqsf6ndc\",\"originX\":\"center\",\"originY\":\"top\",\"left\":310,\"top\":170,\"width\":440,\"fill\":\"#ffffff\",\"fontSize\":42,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"5 PRINCIPLES OF\\nTEAM LEADERSHIP\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_jkoklmnu\",\"originX\":\"center\",\"originY\":\"top\",\"left\":310,\"top\":320,\"width\":440,\"fill\":\"#94a3b8\",\"fontSize\":18,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Mapping seat limits, delegation, and role metrics.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_5ebe3ixp\",\"originX\":\"left\",\"originY\":\"top\",\"left\":110,\"top\":410,\"width\":220,\"height\":52,\"fill\":\"#3b82f6\",\"rx\":10,\"ry\":10,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_bi4nxx9b\",\"originX\":\"center\",\"originY\":\"top\",\"left\":220,\"top\":425,\"width\":200,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"READ ARTICLE\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_drkh05h6\",\"originX\":\"left\",\"originY\":\"top\",\"left\":600,\"top\":60,\"width\":540,\"height\":508,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_hq7fcflx\",\"originX\":\"left\",\"originY\":\"top\",\"left\":615,\"top\":299,\"width\":510,\"fill\":\"#64748b\",\"fontSize\":25,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Corporate boardroom team\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_fndiorho",
  "name": "✨ LI Modern Hiring Alert",
  "category": "Social Media",
  "thumbnail": "#ffffff",
  "width": 1200,
  "height": 628,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_io4es585\",\"left\":0,\"top\":0,\"width\":1200,\"height\":628,\"fill\":\"#ffffff\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_gynjwujo\",\"originX\":\"left\",\"originY\":\"top\",\"left\":40,\"top\":40,\"width\":1120,\"height\":548,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#27272a\",\"strokeWidth\":1},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_gqi0sua9\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":480,\"height\":508,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_otqnjza7\",\"originX\":\"left\",\"originY\":\"top\",\"left\":75,\"top\":299,\"width\":450,\"fill\":\"#64748b\",\"fontSize\":24,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Friendly recruiter\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_xpgodv4v\",\"originX\":\"left\",\"originY\":\"top\",\"left\":580,\"top\":60,\"width\":560,\"height\":508,\"fill\":\"#f4f4f5\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_6twsjip5\",\"originX\":\"center\",\"originY\":\"top\",\"left\":860,\"top\":120,\"width\":500,\"fill\":\"#18181b\",\"fontSize\":34,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WE ARE HIRING\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_sd6ii8v0\",\"originX\":\"center\",\"originY\":\"top\",\"left\":860,\"top\":180,\"width\":500,\"fill\":\"#7f1d1d\",\"fontSize\":42,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SENIOR FRONTEND\\nDEVELOPER\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_mf9gofyz\",\"originX\":\"center\",\"originY\":\"top\",\"left\":860,\"top\":320,\"width\":460,\"fill\":\"#71717a\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Pairing visual editors, React state, and strict typography rules.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_s2z8hn1l\",\"originX\":\"left\",\"originY\":\"top\",\"left\":640,\"top\":430,\"width\":240,\"height\":52,\"fill\":\"#18181b\",\"rx\":8,\"ry\":8,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_5dfa8efi\",\"originX\":\"center\",\"originY\":\"top\",\"left\":760,\"top\":445,\"width\":240,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"APPLY TODAY\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_r4mkkxvd",
  "name": "✨ LI Industry Keynote Banner",
  "category": "Event & Announcement",
  "thumbnail": "#064e3b",
  "width": 1200,
  "height": 628,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_2cvp26lf\",\"left\":0,\"top\":0,\"width\":1200,\"height\":628,\"fill\":\"#064e3b\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_8cz1yab7\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":1080,\"height\":508,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#d97706\",\"strokeWidth\":2},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_62arhsoj\",\"originX\":\"center\",\"originY\":\"top\",\"left\":600,\"top\":120,\"width\":900,\"fill\":\"#d97706\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"INDUSTRY EVENT 2026\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_68vfjt6y\",\"originX\":\"center\",\"originY\":\"top\",\"left\":600,\"top\":180,\"width\":980,\"fill\":\"#ffffff\",\"fontSize\":54,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SCALING DIGITAL WORKFLOWS\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_23s3s0m8\",\"originX\":\"center\",\"originY\":\"top\",\"left\":600,\"top\":320,\"width\":880,\"fill\":\"#a7f3d0\",\"fontSize\":22,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Learn modular design layouts, automated scheduling, and connection pipelines.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_fwpsf5ub\",\"originX\":\"left\",\"originY\":\"top\",\"left\":475,\"top\":430,\"width\":250,\"height\":52,\"fill\":\"#d97706\",\"rx\":10,\"ry\":10,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_f7oddcam\",\"originX\":\"center\",\"originY\":\"top\",\"left\":600,\"top\":445,\"width\":250,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"REGISTER NOW\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_w2gkd6qp",
  "name": "✨ LI Team Milestones",
  "category": "Social Media",
  "thumbnail": "#0b0f1a",
  "width": 1200,
  "height": 628,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_x7ofquw5\",\"left\":0,\"top\":0,\"width\":1200,\"height\":628,\"fill\":\"#0b0f1a\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_vfxgevwy\",\"originX\":\"left\",\"originY\":\"top\",\"left\":1000,\"top\":150,\"radius\":120,\"fill\":\"rgba(255, 0, 110, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_djh357mq\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":640,\"height\":508,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_7sqj9nii\",\"originX\":\"left\",\"originY\":\"top\",\"left\":75,\"top\":299,\"width\":610,\"fill\":\"#64748b\",\"fontSize\":25,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Co-working team high-five\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_q82fyf7d\",\"originX\":\"left\",\"originY\":\"top\",\"left\":740,\"top\":60,\"width\":400,\"height\":508,\"fill\":\"rgba(255,255,255,0.03)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_hmu459qu\",\"originX\":\"center\",\"originY\":\"top\",\"left\":940,\"top\":120,\"width\":340,\"fill\":\"#ff006e\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"TEAM CELEBRATION\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_epemsa66\",\"originX\":\"center\",\"originY\":\"top\",\"left\":940,\"top\":180,\"width\":340,\"fill\":\"#ffffff\",\"fontSize\":38,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Q1 MILESTONES\\nCOMPLETED\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_vx9r44v0\",\"originX\":\"center\",\"originY\":\"top\",\"left\":940,\"top\":320,\"width\":340,\"fill\":\"rgba(255,255,255,0.7)\",\"fontSize\":18,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"We hit 100 templates deployed successfully under strict timeline guidelines.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_umu7proj\",\"originX\":\"left\",\"originY\":\"top\",\"left\":790,\"top\":430,\"width\":300,\"height\":52,\"fill\":\"#ff006e\",\"rx\":14,\"ry\":14,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_gd6da0gr\",\"originX\":\"center\",\"originY\":\"top\",\"left\":940,\"top\":445,\"width\":300,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"MEET THE TEAM\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_iunkc3ef",
  "name": "✨ X Job Alert Banner",
  "category": "Social Media",
  "thumbnail": "#1e293b",
  "width": 1200,
  "height": 675,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_e8rhvmdr\",\"left\":0,\"top\":0,\"width\":1200,\"height\":675,\"fill\":\"#1e293b\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_4v28qf6z\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":150,\"radius\":80,\"fill\":\"rgba(180, 83, 9, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_kzv6foaw\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":540,\"height\":555,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_59q01bwj\",\"originX\":\"left\",\"originY\":\"top\",\"left\":75,\"top\":322.5,\"width\":510,\"fill\":\"#64748b\",\"fontSize\":27,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Happy office desk\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_bffs6qsu\",\"originX\":\"left\",\"originY\":\"top\",\"left\":640,\"top\":60,\"width\":500,\"height\":555,\"fill\":\"rgba(255, 255, 255, 0.04)\",\"rx\":24,\"ry\":24,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_pwfwxppe\",\"originX\":\"center\",\"originY\":\"top\",\"left\":890,\"top\":140,\"width\":440,\"fill\":\"#b45309\",\"fontSize\":32,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"JOIN OUR SQUAD\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_mg91c3ub\",\"originX\":\"center\",\"originY\":\"top\",\"left\":890,\"top\":210,\"width\":440,\"fill\":\"#ffffff\",\"fontSize\":42,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WE ARE LOOKING FOR\\nA CONTENT PRO\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_wm24azx9\",\"originX\":\"center\",\"originY\":\"top\",\"left\":890,\"top\":370,\"width\":400,\"fill\":\"#cbd5e1\",\"fontSize\":20,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Write copy, build canvas matrices, and schedule direct streams.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_6tmmp666\",\"originX\":\"left\",\"originY\":\"top\",\"left\":740,\"top\":470,\"width\":300,\"height\":52,\"fill\":\"#b45309\",\"rx\":12,\"ry\":12,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_aq6j0hes\",\"originX\":\"center\",\"originY\":\"top\",\"left\":890,\"top\":485,\"width\":300,\"fill\":\"#ffffff\",\"fontSize\":16,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"SUBMIT PORTFOLIO\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_mdc2dn67",
  "name": "✨ X Clean Quote Tweet Card",
  "category": "Motivational & Quotes",
  "thumbnail": "#ffeaa7",
  "width": 1200,
  "height": 675,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_x5db3mgy\",\"left\":0,\"top\":0,\"width\":1200,\"height\":675,\"fill\":{\"type\":\"linear\",\"coords\":{\"x1\":0,\"y1\":0,\"x2\":1200,\"y2\":675},\"colorStops\":[{\"offset\":0,\"color\":\"#ffeaa7\"},{\"offset\":1,\"color\":\"#fdcb6e\"}]},\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_mp8nzlxp\",\"originX\":\"left\",\"originY\":\"top\",\"left\":1000,\"top\":500,\"radius\":130,\"fill\":\"rgba(217, 119, 6, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_ql8y13z6\",\"originX\":\"left\",\"originY\":\"top\",\"left\":60,\"top\":60,\"width\":1080,\"height\":555,\"fill\":\"#ffffff\",\"rx\":28,\"ry\":28,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_al7xib8h\",\"originX\":\"center\",\"originY\":\"top\",\"left\":600,\"top\":100,\"width\":960,\"fill\":\"#d97706\",\"fontSize\":180,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"“\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_brvd440h\",\"originX\":\"center\",\"originY\":\"top\",\"left\":600,\"top\":270,\"width\":960,\"fill\":\"#78350f\",\"fontSize\":48,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"THE BEST WAY TO PREDICT THE\\nFUTURE IS TO AUTOMATE IT.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_s4z297rf\",\"originX\":\"center\",\"originY\":\"top\",\"left\":600,\"top\":440,\"width\":960,\"fill\":\"#92400e\",\"fontSize\":22,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Simplify tasks to compound high-class growth.\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_cap7yw6w",
  "name": "✨ LI Tech Innovation Cover",
  "category": "Tech & SaaS",
  "thumbnail": "#0f172a",
  "width": 1584,
  "height": 396,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_7q5zqm3c\",\"left\":0,\"top\":0,\"width\":1584,\"height\":396,\"fill\":\"#0f172a\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_73rn0tdt\",\"originX\":\"left\",\"originY\":\"top\",\"left\":1400,\"top\":200,\"radius\":120,\"fill\":\"rgba(59, 130, 246, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_rvv1ixdu\",\"originX\":\"left\",\"originY\":\"top\",\"left\":50,\"top\":40,\"width\":800,\"height\":316,\"fill\":\"rgba(255,255,255,0.03)\",\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_gfb1tvxn\",\"originX\":\"left\",\"originY\":\"top\",\"left\":450,\"top\":80,\"width\":700,\"fill\":\"#3b82f6\",\"fontSize\":24,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"PIXASOCIAL ENTERPRISE SUITE\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_hvq3404k\",\"originX\":\"left\",\"originY\":\"top\",\"left\":450,\"top\":125,\"width\":700,\"fill\":\"#ffffff\",\"fontSize\":38,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"AUTOMATE YOUR BRAND ON EVERY PLATFORM\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_taah23z1\",\"originX\":\"left\",\"originY\":\"top\",\"left\":450,\"top\":230,\"width\":700,\"fill\":\"#94a3b8\",\"fontSize\":18,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"The all-in-one graphical design scheduler live on staging.\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_6n6k4b3a\",\"originX\":\"left\",\"originY\":\"top\",\"left\":900,\"top\":40,\"width\":634,\"height\":316,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_4qjf98ir\",\"originX\":\"left\",\"originY\":\"top\",\"left\":915,\"top\":183,\"width\":604,\"fill\":\"#64748b\",\"fontSize\":16,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Platform Mockup Showcase\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_najtf2ro",
  "name": "✨ LI Luxury Dark Cover",
  "category": "Social Media",
  "thumbnail": "#09090b",
  "width": 1584,
  "height": 396,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_hh6bknc1\",\"left\":0,\"top\":0,\"width\":1584,\"height\":396,\"fill\":\"#09090b\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_n4e0isjf\",\"originX\":\"left\",\"originY\":\"top\",\"left\":30,\"top\":30,\"width\":1524,\"height\":336,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#d4af37\",\"strokeWidth\":2},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_js6thrn0\",\"originX\":\"left\",\"originY\":\"top\",\"left\":80,\"top\":60,\"width\":500,\"height\":276,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":18,\"ry\":18,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_ptmyehcc\",\"originX\":\"left\",\"originY\":\"top\",\"left\":95,\"top\":183,\"width\":470,\"fill\":\"#64748b\",\"fontSize\":16,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Luxury Office Façade\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_9cgzbpdz\",\"originX\":\"left\",\"originY\":\"top\",\"left\":920,\"top\":100,\"width\":600,\"fill\":\"#d4af37\",\"fontSize\":28,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"PRESTIGE PROPERTIES\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_bc8zogne\",\"originX\":\"left\",\"originY\":\"top\",\"left\":920,\"top\":145,\"width\":600,\"fill\":\"#fafaf9\",\"fontSize\":34,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"INVEST IN THE HORIZON OF REAL ESTATE\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_u0h2wzhh\",\"originX\":\"left\",\"originY\":\"top\",\"left\":920,\"top\":235,\"width\":600,\"fill\":\"#a1a1aa\",\"fontSize\":16,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Exclusive private listings, corporate hubs, and prime coastal flatlands.\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_wmnb1b7u",
  "name": "✨ X Professional Header Minimal",
  "category": "Social Media",
  "thumbnail": "#fafafa",
  "width": 1500,
  "height": 500,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_mmgfccej\",\"left\":0,\"top\":0,\"width\":1500,\"height\":500,\"fill\":\"#fafafa\",\"selectable\":false,\"evented\":false},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_k5u162c5\",\"originX\":\"left\",\"originY\":\"top\",\"left\":30,\"top\":30,\"width\":1440,\"height\":440,\"fill\":\"transparent\",\"rx\":0,\"ry\":0,\"selectable\":true,\"evented\":true,\"stroke\":\"#27272a\",\"strokeWidth\":1},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_qxdj9zne\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":150,\"width\":700,\"fill\":\"#27272a\",\"fontSize\":24,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"MINIMALIST DESIGN STUDIO\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_d586m5du\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":200,\"width\":700,\"fill\":\"#27272a\",\"fontSize\":48,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"WE SHAPE DIGITAL IDENTITIES\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_fh5vbwbi\",\"originX\":\"left\",\"originY\":\"top\",\"left\":150,\"top\":310,\"width\":700,\"fill\":\"#71717a\",\"fontSize\":18,\"fontWeight\":\"500\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Clean grid ratios, dynamic font pairings, and responsive visual layout code.\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_m6v8gpdb\",\"originX\":\"left\",\"originY\":\"top\",\"left\":920,\"top\":50,\"width\":530,\"height\":400,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":16,\"ry\":16,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_vd34nism\",\"originX\":\"left\",\"originY\":\"top\",\"left\":935,\"top\":235,\"width\":500,\"fill\":\"#64748b\",\"fontSize\":20,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Line Illustration Showcase\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
TEMPLATES.push({
  "id": "new_tmpl_krfai73d",
  "name": "✨ X Dark Techno Header",
  "category": "Tech & SaaS",
  "thumbnail": "#030712",
  "width": 1500,
  "height": 500,
  "json": "{\"version\":\"5.3.0\",\"objects\":[{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"bg_76rdbqqm\",\"left\":0,\"top\":0,\"width\":1500,\"height\":500,\"fill\":\"#030712\",\"selectable\":false,\"evented\":false},{\"type\":\"circle\",\"version\":\"5.3.0\",\"id\":\"circle_0o2kyuuv\",\"originX\":\"left\",\"originY\":\"top\",\"left\":1300,\"top\":250,\"radius\":120,\"fill\":\"rgba(6, 182, 212, 0.15)\",\"opacity\":0.4,\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"rect_2vj5ypgv\",\"originX\":\"left\",\"originY\":\"top\",\"left\":50,\"top\":50,\"width\":700,\"height\":400,\"fill\":\"rgba(255,255,255,0.02)\",\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true,\"stroke\":\"rgba(244,63,94,0.3)\",\"strokeWidth\":1},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_ygic9mjb\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":130,\"width\":560,\"fill\":\"#f43f5e\",\"fontSize\":26,\"fontWeight\":\"bold\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"CYBERNETIC SYSTEMS\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_yjhvgxp5\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":185,\"width\":560,\"fill\":\"#ffffff\",\"fontSize\":38,\"fontWeight\":\"900\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"THE NEW FUTURE OF AUTO WORKFLOWS\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"txt_27m0zdkw\",\"originX\":\"left\",\"originY\":\"top\",\"left\":120,\"top\":290,\"width\":560,\"fill\":\"#06b6d4\",\"fontSize\":18,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"Unlocking high-contrast networks, PM2 process daemons, and zero tokens.\",\"textAlign\":\"left\",\"selectable\":true,\"evented\":true},{\"type\":\"rect\",\"version\":\"5.3.0\",\"id\":\"frame_uw5dvxjr\",\"originX\":\"left\",\"originY\":\"top\",\"left\":820,\"top\":50,\"width\":630,\"height\":400,\"fill\":\"#f1f5f9\",\"stroke\":\"#94a3b8\",\"strokeWidth\":2,\"strokeDashArray\":[8,8],\"rx\":20,\"ry\":20,\"selectable\":true,\"evented\":true},{\"type\":\"textbox\",\"version\":\"5.3.0\",\"id\":\"frame_label_nq58fc2h\",\"originX\":\"left\",\"originY\":\"top\",\"left\":835,\"top\":235,\"width\":600,\"fill\":\"#64748b\",\"fontSize\":20,\"fontWeight\":\"600\",\"fontFamily\":\"Inter, Arial, sans-serif\",\"text\":\"📷 Future Abstract AI Grid\",\"textAlign\":\"center\",\"selectable\":true,\"evented\":true}],\"background\":\"transparent\"}"
});
