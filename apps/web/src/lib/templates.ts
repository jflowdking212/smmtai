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
];

export function getTemplatesByCategory(category?: string): TemplateData[] {
  if (!category) return TEMPLATES;
  return TEMPLATES.filter((t) => t.category === category);
}

export function getCategories(): string[] {
  return CATEGORIES;
}
