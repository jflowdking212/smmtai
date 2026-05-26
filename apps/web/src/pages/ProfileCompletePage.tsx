import { useState, useRef } from 'react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Camera, Phone, Globe, Check, Loader2, Sparkles, ChevronRight, User
} from 'lucide-react';

const COUNTRIES = [
  'Nigeria','United States','United Kingdom','Canada','Australia','Ghana',
  'Kenya','South Africa','India','Germany','France','Brazil','Mexico',
  'Philippines','Indonesia','Pakistan','Bangladesh','Russia','Japan',
  'China','Egypt','Ethiopia','Tanzania','Uganda','Cameroon','Senegal',
  'Zimbabwe','Zambia','Rwanda','Ivory Coast','Other'
];

const TIMEZONES = [
  { label: 'Africa/Lagos (WAT)', value: 'Africa/Lagos' },
  { label: 'America/New_York (ET)', value: 'America/New_York' },
  { label: 'America/Chicago (CT)', value: 'America/Chicago' },
  { label: 'America/Denver (MT)', value: 'America/Denver' },
  { label: 'America/Los_Angeles (PT)', value: 'America/Los_Angeles' },
  { label: 'America/Sao_Paulo (BRT)', value: 'America/Sao_Paulo' },
  { label: 'Europe/London (GMT)', value: 'Europe/London' },
  { label: 'Europe/Paris (CET)', value: 'Europe/Paris' },
  { label: 'Europe/Moscow (MSK)', value: 'Europe/Moscow' },
  { label: 'Asia/Dubai (GST)', value: 'Asia/Dubai' },
  { label: 'Asia/Kolkata (IST)', value: 'Asia/Kolkata' },
  { label: 'Asia/Bangkok (ICT)', value: 'Asia/Bangkok' },
  { label: 'Asia/Singapore (SGT)', value: 'Asia/Singapore' },
  { label: 'Asia/Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'Asia/Shanghai (CST)', value: 'Asia/Shanghai' },
  { label: 'Australia/Sydney (AEST)', value: 'Australia/Sydney' },
  { label: 'Pacific/Auckland (NZST)', value: 'Pacific/Auckland' },
  { label: 'UTC', value: 'UTC' },
];

export function ProfileCompletePage() {
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Avatar
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatar || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2: Info
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [name, setName] = useState(user?.name || '');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarPreview(dataUrl);
      setAvatarUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!phone.trim()) { toast.error('Required', 'Please enter your phone number.'); return; }
    setSaving(true);
    try {
      const res = await api.users.updateProfile({
        name: name || user?.name,
        avatar: avatarUrl || undefined,
        phone,
        country,
        timezone,
      });
      // Update auth store
      setUser({ ...user!, ...res.data });
      toast.success('Profile complete!', 'Welcome to SmmtAI 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { num: 1, label: 'Photo' },
    { num: 2, label: 'Details' },
    { num: 3, label: 'Done' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue/5 via-white to-purple-50 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="font-heading font-bold text-xl text-neutral-900">SmmtAI</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden">
        {/* Progress */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step > s.num ? 'bg-green-500 text-white' :
                  step === s.num ? 'bg-brand-blue text-white' :
                  'bg-neutral-100 text-neutral-400'
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 w-16 mx-2 rounded transition-all ${step > s.num ? 'bg-green-500' : 'bg-neutral-200'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-neutral-400 mt-1">
            {steps.map(s => <span key={s.num}>{s.label}</span>)}
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Step 1: Avatar */}
          {step === 1 && (
            <div className="text-center">
              <h1 className="text-xl font-heading font-bold text-neutral-900 mb-1">Add a profile photo</h1>
              <p className="text-sm text-neutral-500 mb-6">Help your team recognise you</p>

              <div className="relative mx-auto w-32 h-32 mb-6">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-brand-blue/20 to-purple-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-neutral-300" />
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-10 h-10 bg-brand-blue rounded-full flex items-center justify-center shadow-md hover:bg-brand-blue/90 transition-colors"
                >
                  <Camera className="w-5 h-5 text-white" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <p className="text-xs text-neutral-400 mb-6">JPG, PNG or GIF • Max 5MB</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 text-sm text-neutral-500 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-blue rounded-xl hover:bg-brand-blue/90 transition-colors flex items-center justify-center gap-2"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Info */}
          {step === 2 && (
            <div>
              <h1 className="text-xl font-heading font-bold text-neutral-900 mb-1">Complete your profile</h1>
              <p className="text-sm text-neutral-500 mb-6">You need to complete this to start posting</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full Name *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    <Phone className="w-3.5 h-3.5 inline mr-1" />Phone Number *
                  </label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                    type="tel"
                    className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    <Globe className="w-3.5 h-3.5 inline mr-1" />Country *
                  </label>
                  <select
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  >
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Timezone *</label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  >
                    {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-sm text-neutral-500 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-blue rounded-xl hover:bg-brand-blue/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Complete Profile</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-neutral-400 mt-4 text-center">
        You can update these anytime in Settings
      </p>
    </div>
  );
}
