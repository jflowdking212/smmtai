import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2, Phone, Mail, UserIcon, Mic, MicOff, Loader2, Pencil, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sources?: Array<{ title: string; category?: string }>;
}

interface CustomerInfo {
  name: string;
  email: string;
  phone?: string;
}

const API_BASE = '/api/v1';

// ── User preferences & onboarding ───────────────────────────────────────────
const ONBOARDING_PREFS_KEY = 'smmtai_user_prefs_v1';
const ONBOARDING_DONE_KEY  = 'smmtai_onboarding_v2_done';

function getStoredPrefs(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(ONBOARDING_PREFS_KEY) || '{}'); } catch { return {}; }
}
function saveStoredPrefs(patch: Record<string, any>): Record<string, any> {
  const merged = { ...getStoredPrefs(), ...patch };
  localStorage.setItem(ONBOARDING_PREFS_KEY, JSON.stringify(merged));
  return merged;
}
function getAiName(): string { return getStoredPrefs().aiName || ''; }
function isOnboardingDone(): boolean {
  if (localStorage.getItem(ONBOARDING_DONE_KEY) === '1') return true;
  if (localStorage.getItem('smmtai_onboarding_dismissed') === 'true') return true;
  return false;
}

// -- Onboarding steps (popup-based) --
const ONBOARDING_STEPS: Array<{
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  inputType: 'text' | 'date' | 'chips' | 'multi-chips';
  placeholder?: string;
  options?: string[];
}> = [
  {
    key: 'favoriteColor',
    emoji: '🎨',
    title: "What's your favorite color?",
    subtitle: 'Helps us personalize your experience.',
    inputType: 'chips',
    options: ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Black', 'White', 'Other'],
  },
  {
    key: 'platforms',
    emoji: '📱',
    title: 'Which platforms do you use most?',
    subtitle: 'Select all that apply.',
    inputType: 'multi-chips',
    options: ['Facebook', 'Instagram', 'Twitter/X', 'LinkedIn', 'YouTube', 'TikTok', 'Pinterest', 'Discord', 'Slack', 'Telegram', 'Reddit', 'Threads', 'Tumblr', 'Bluesky', 'WordPress', 'Medium'],
  },
  {
    key: 'contentType',
    emoji: '✍️',
    title: 'What type of content do you create?',
    subtitle: "We'll tailor suggestions to your style.",
    inputType: 'chips',
    options: ['Educational', 'Entertainment', 'Inspirational', 'Promotional', 'Behind-the-Scenes', 'Mixed'],
  },
  {
    key: 'food',
    emoji: '🍕',
    title: "What's your favorite food?",
    subtitle: 'Just for fun — helps me know you better!',
    inputType: 'text',
    placeholder: 'e.g. Pizza, Sushi, Jollof rice',
  },
  {
    key: 'birthday',
    emoji: '🎂',
    title: "When's your birthday?",
    subtitle: "I'll send you a special greeting on your big day!",
    inputType: 'date',
    placeholder: 'e.g. April 15',
  },
  {
    key: 'goal',
    emoji: '🎯',
    title: 'What is your main goal with SmmtAI?',
    subtitle: 'Choose the one that fits best.',
    inputType: 'chips',
    options: ['Grow my audience', 'Save time posting', 'Track analytics', 'Build my brand', 'Generate leads', 'All of the above'],
  },
  {
    key: 'aiName',
    emoji: '🤖',
    title: 'What should I call myself?',
    subtitle: "Give your AI assistant a personal name!",
    inputType: 'text',
    placeholder: 'e.g. Aria, Max, Luna, Zara',
  },
];

async function syncPrefsToServer(prefs: Record<string, any>): Promise<void> {
  try {
    await fetch('/api/v1/users/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(prefs),
    });
  } catch { /* non-critical */ }
}

const CSRF_COOKIE = 'csrfToken';

// ─── Enhanced Markdown renderer ───────────────────────────────────────────
// Converts bot response markdown to clean, wrapping JSX with link and list support.
function renderMessageContent(content: string) {
  const lines = content.split('\n');

  // Parse inline styles: **bold**, *italic*, `code`, [link](url)
  const parseInline = (text: string, keyPfx: string) => {
    const result: React.ReactNode[] = [];
    let idx = 0; let buf = ''; let k = 0;
    const flush = () => { if (buf) { result.push(<span key={`${keyPfx}-t${k++}`}>{buf}</span>); buf = ''; } };
    while (idx < text.length) {
      // Bold **text**
      if (text[idx] === '*' && text[idx + 1] === '*') {
        const end = text.indexOf('**', idx + 2);
        if (end !== -1) {
          flush();
          const innerText = text.slice(idx + 2, end);
          result.push(
            <strong key={`${keyPfx}-b${k++}`} className="font-bold text-neutral-900 dark:text-white">
              {parseInline(innerText, `${keyPfx}-b${k}`)}
            </strong>
          );
          idx = end + 2;
          continue;
        }
      }
      // Italic *text*
      if (text[idx] === '*' && text[idx + 1] !== '*') {
        const end = text.indexOf('*', idx + 1);
        if (end !== -1) {
          flush();
          const innerText = text.slice(idx + 1, end);
          result.push(
            <em key={`${keyPfx}-i${k++}`} className="italic">
              {parseInline(innerText, `${keyPfx}-i${k}`)}
            </em>
          );
          idx = end + 1;
          continue;
        }
      }
      // Code `code`
      if (text[idx] === '`') {
        const end = text.indexOf('`', idx + 1);
        if (end !== -1) {
          flush();
          result.push(
            <code key={`${keyPfx}-c${k++}`} className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-mono border border-neutral-200/50 dark:border-neutral-700/50 text-neutral-800 dark:text-neutral-200">
              {text.slice(idx + 1, end)}
            </code>
          );
          idx = end + 1;
          continue;
        }
      }
      // Markdown Link [text](url)
      if (text[idx] === '[') {
        const endText = text.indexOf(']', idx + 1);
        if (endText !== -1 && text[endText + 1] === '(') {
          const endUrl = text.indexOf(')', endText + 2);
          if (endUrl !== -1) {
            flush();
            const linkText = text.slice(idx + 1, endText);
            const linkUrl = text.slice(endText + 2, endUrl);
            result.push(
              <a
                key={`${keyPfx}-l${k++}`}
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold break-all inline"
              >
                {linkText}
              </a>
            );
            idx = endUrl + 1;
            continue;
          }
        }
      }
      buf += text[idx]; idx++;
    }
    flush();
    return result;
  };

  return (
    <div className="space-y-1.5 break-words whitespace-pre-wrap overflow-hidden" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2.5" />;
        
        // Headers (e.g. # Header, ## Header)
        const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const txt = headerMatch[2];
          const className = level === 1 
            ? 'text-lg font-bold my-2 text-neutral-900 dark:text-white' 
            : level === 2 
              ? 'text-base font-bold my-1.5 text-neutral-900 dark:text-white' 
              : 'text-sm font-semibold my-1 text-neutral-900 dark:text-white';
          return <div key={i} className={className}>{parseInline(txt, `${i}`)}</div>;
        }

        // Bullet item
        if (/^[\u2022\-\*]\s/.test(line)) {
          const txt = line.replace(/^[\u2022\-\*]\s+/, '');
          return (
            <div key={i} className="flex gap-2 items-start pl-1">
              <span className="opacity-50 shrink-0 leading-5 select-none">•</span>
              <span className="leading-5 flex-1">{parseInline(txt, `${i}`)}</span>
            </div>
          );
        }

        // Numbered list item
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-2 items-start pl-1">
              <span className="opacity-70 shrink-0 font-medium leading-5 min-w-[1rem] select-none text-right">{numMatch[1]}.</span>
              <span className="leading-5 flex-1">{parseInline(numMatch[2], `${i}`)}</span>
            </div>
          );
        }

        return <div key={i} className="leading-5">{parseInline(line, `${i}`)}</div>;
      })}
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────


function getCookieValue(name: string): string | null {
  const cookies = typeof document !== 'undefined' && document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function getJsonHeaders(): HeadersInit {
  const csrfToken = getCookieValue(CSRF_COOKIE);
  const token = useAuthStore.getState().accessToken;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (csrfToken) (headers as any)['x-csrf-token'] = csrfToken;
  if (token) (headers as any)['Authorization'] = `Bearer ${token}`;
  return headers;
}


// ── Apply a new AI name immediately (chat or inline edit) ─────────────────────
function applyRenameHelper(name: string, setCurrentAiName: (n: string) => void) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return;
  setCurrentAiName(trimmed);
  saveStoredPrefs({ aiName: trimmed });
  syncPrefsToServer({ aiName: trimmed }).catch(() => {});
}

// ── Detect rename intent from natural language ─────────────────────────────────
function detectRenameIntent(msg: string): string | null {
  const m = msg.trim();
  const patterns = [
    /^(?:please\s+)?(?:rename\s+yourself|call\s+yourself|your\s+name\s+is\s+now|your\s+new\s+name\s+is|go\s+by|i(?:'ll|\s+will)\s+call\s+you|from\s+now\s+on\s+(?:you(?:'re|\s+are)|your\s+name\s+is)|you(?:'re|\s+are)\s+now\s+called)\s+(.+)/i,
    /^(?:i\s+want\s+to\s+(?:call|name)\s+you|let(?:'s|\s+me)\s+call\s+you)\s+(.+)/i,
    /^(?:change\s+your\s+name\s+to|set\s+your\s+name\s+to|name\s+yourself)\s+(.+)/i,
  ];
  for (const rx of patterns) {
    const match = m.match(rx);
    if (match) {
      // Strip trailing punctuation
      return match[1].replace(/[.!?,;]+$/, '').trim().slice(0, 40);
    }
  }
  return null;
}

// Build personalized onboarding completion message
function buildCompletionMessage(
  answers: Record<string, string>,
  aiName: string,
  userName: string
): string {
  const name = aiName || 'your SmmtAI assistant';
  const who  = userName ? ', ' + userName : '';
  const lines: string[] = [
    answers.favoriteColor ? '• Favorite color: **' + answers.favoriteColor + '**' : '',
    answers.platforms     ? '• Platforms: **' + answers.platforms + '**' : '',
    answers.contentType   ? '• Content type: **' + answers.contentType + '**' : '',
    answers.food          ? '• Favorite food: **' + answers.food + '**' : '',
    answers.birthday      ? '• Birthday: **' + answers.birthday + '**' : '',
    answers.goal          ? '• Goal: **' + answers.goal + '**' : '',
  ].filter(Boolean);
  return [
    '🎉 **All set' + who + '!**',
    '',
    'I\'m now **' + name + '** — personalized just for you! 😊',
    lines.length ? '' : '',
    lines.length ? 'Here\'s what I noted:' : '',
    ...lines,
    '',
    'How can I help you today?',
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  // Onboarding state
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [onboardingStepIdx, setOnboardingStepIdx] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState<Record<string, string>>({});
  const [currentAiName, setCurrentAiName] = useState(getAiName);
  // Inline rename state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  // Popup onboarding state
  const [onboardingPopupOpen, setOnboardingPopupOpen] = useState(false);
  const [onboardingPopupStep, setOnboardingPopupStep] = useState(0);
  const [onboardingPopupInput, setOnboardingPopupInput] = useState('');
  const [onboardingMultiSel, setOnboardingMultiSel] = useState<string[]>([]);


  // Read auth state reactively from the store (persisted across page loads)
  const authUser = useAuthStore((s) => s.user);
  const authWorkspaceId = useAuthStore((s) => s.workspaceId);
  const isLoggedIn = !!authUser; // Rely on persisted user object, not volatile isAuthenticated

  // Listen for external open requests (e.g., from Help page)
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-chatbot', handler);
    return () => window.removeEventListener('open-chatbot', handler);
  }, []);

  const storedAiName = currentAiName || getAiName();
  const greeting = isLoggedIn && authUser
    ? `Hi ${authUser.name}! 👋 I'm ${storedAiName || 'your SmmtAI assistant'}. I have full visibility into your workspace — ask me about your posts, analytics, drafts, or just tell me to do something!`
    : `Hi! 👋 I'm ${storedAiName || 'your SmmtAI assistant'}. I can help you with questions about social media management, scheduling, analytics, and more. How can I help?`;

  const [messages, setMessages] = useState<Message[]>(() => [
    { id: '1', content: greeting, sender: 'bot', timestamp: new Date() },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({ name: '', email: '' });
  const [isContactSubmitted, setIsContactSubmitted] = useState(false);
  const [botResponseCount, setBotResponseCount] = useState(0);
  const [needsTransfer, setNeedsTransfer] = useState(false);
  const [contactStage, setContactStage] = useState<'none' | 'name' | 'email'>('none');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync auth state to customerInfo so logged in users never get prompted for name or email
  useEffect(() => {
    if (isLoggedIn && authUser) {
      setCustomerInfo({
        name: authUser.name || '',
        email: authUser.email || '',
      });
      setIsContactSubmitted(true);
      setContactStage('none');
    }
  }, [isLoggedIn, authUser]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // ---- Voice recording ----
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Paid OpenAI Text-to-Speech Ref & State ----
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setIsPlayingAudio(false);
  }, []);

  // Cancel speech on unmount
  useEffect(() => () => stopAudio(), [stopAudio]);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const startRecording = async () => {
    if (isRecording) { stopRecording(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 1000) return; // discard near-empty recordings

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          const ext = mimeType.includes('webm') ? 'webm' : 'ogg';
          formData.append('audio', audioBlob, `voice.${ext}`);

          const csrfToken = getCookieValue(CSRF_COOKIE);
          const headers: Record<string, string> = {};
          if (csrfToken) headers['x-csrf-token'] = csrfToken;
          const token = useAuthStore.getState().accessToken;
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch(`${API_BASE}/chat/transcribe`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: formData,
          });
          const data = await res.json();
          if (data.success && data.transcript) {
            // Auto-fill the input and send immediately
            sendMessage(data.transcript, true);
          } else {
            setMessages((prev) => [
              ...prev,
              { id: Date.now().toString(), content: data.error || 'Could not understand audio. Please try again.', sender: 'bot', timestamp: new Date() },
            ]);
          }
        } catch {
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), content: 'Voice transcription failed. Please check your connection.', sender: 'bot', timestamp: new Date() },
          ]);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start(250); // collect data every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);

      // Auto-stop after 60 seconds
      setTimeout(() => { if (mediaRecorderRef.current?.state === 'recording') stopRecording(); }, 60000);
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          content: denied
            ? 'Microphone access was denied. Please allow microphone access in your browser settings.'
            : 'Could not access your microphone. Please check your device.',
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    }
  };

  // Cleanup recording on unmount
  useEffect(() => () => {
    stopRecording();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, []);

  useEffect(() => {
    const init = async () => {
      let activeSessionId = '';
      if (isLoggedIn && authUser && authWorkspaceId) {
        // Tie session ID directly to user and workspace for complete security and isolation
        activeSessionId = `session_${authUser.id}_${authWorkspaceId}`;
      } else {
        // Anonymous sessions use a persistent random guest ID
        const existing = localStorage.getItem('pmChatSessionId');
        if (existing && !existing.startsWith('session_usr_') && !existing.startsWith('session_')) {
          activeSessionId = existing;
        } else {
          activeSessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          localStorage.setItem('pmChatSessionId', activeSessionId);
        }
      }

      setSessionId(activeSessionId);

      // Reset messages to base greeting first to prevent flash of previous history
      const currentGreeting = isLoggedIn && authUser
        ? `Hi ${authUser.name}! 👋 I'm ${storedAiName || currentAiName || 'your SmmtAI assistant'}. I have full visibility into your workspace — ask me about your posts, analytics, drafts, or just tell me to do something!`
        : `Hi! 👋 I'm ${storedAiName || currentAiName || 'your SmmtAI assistant'}. I can help you with questions about social media management, scheduling, analytics, and more. How can I help?`;

      setMessages([
        { id: '1', content: currentGreeting, sender: 'bot', timestamp: new Date() },
      ]);
      setNeedsTransfer(false);
      setContactStage('none');

      try {
        const res = await fetch(`${API_BASE}/chat/conversations/history/${activeSessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
            const loaded = data.messages.map((msg: any, idx: number) => ({
              id: `loaded-${idx}`,
              content: msg.content,
              sender: msg.role as 'user' | 'bot',
              timestamp: new Date(msg.timestamp),
              sources: msg.sources,
            }));
            setMessages([
              { id: '1', content: currentGreeting, sender: 'bot', timestamp: new Date() },
              ...loaded,
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };
    init();
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerInfo.name.trim()) return;
    fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: getJsonHeaders(),
      credentials: 'include',
      body: JSON.stringify({ message: `My name is ${customerInfo.name}`, sessionId, customerInfo: { name: customerInfo.name } }),
    }).catch(() => {});
    localStorage.setItem('pmChatCustomerInfo', JSON.stringify(customerInfo));
    setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), content: `Thank you, ${customerInfo.name}! I will also need your email to serve you better.`, sender: 'bot', timestamp: new Date() }]);
    setContactStage('email');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerInfo.email.trim()) return;
    fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: getJsonHeaders(),
      credentials: 'include',
      body: JSON.stringify({ message: `My email is ${customerInfo.email}`, sessionId, customerInfo }),
    }).catch(() => {});
    localStorage.setItem('pmChatCustomerInfo', JSON.stringify(customerInfo));
    setMessages(prev => [...prev, { id: (Date.now() + 2).toString(), content: "Perfect! I've saved your information. How can I help you further?", sender: 'bot', timestamp: new Date() }]);
    setIsContactSubmitted(true);
    setContactStage('none');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleTransferToAgent = () => {
    const botMessage: Message = {
      id: Date.now().toString(),
      content: "I've noted your request to speak with a human. Please leave your contact information and our team will reach out to you shortly.",
      sender: 'bot', timestamp: new Date(),
    };
    setMessages(prev => [...prev, botMessage]);
    if (!isLoggedIn && !isContactSubmitted && contactStage === 'none') {
      setTimeout(() => {
        setContactStage('name');
        setMessages(prev => [...prev, { id: (Date.now() + 10).toString(), content: 'To help connect you, may I know your name?', sender: 'bot', timestamp: new Date() }]);
      }, 500);
    }
  };

  const playTTS = async (text: string) => {
    try {
      stopAudio(); // Stop currently playing audio first

      // Get a clean, concise version of the text to read aloud
      // This reduces OpenAI generation latency to near-instant (under 500ms)
      // and prevents reading out long lists, IDs, or links.
      let speakText = text
        .replace(/```[\s\S]*?```/g, '') // remove code blocks
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // replace markdown links with text
        .trim();

      // Split into sentences and take the first 2
      const sentences = speakText.split(/(?<=[.!?])\s+/);
      let shortText = sentences.slice(0, 2).join(' ').trim();
      
      // If we ended up with nothing or very short, fallback to first 120 chars
      if (shortText.length < 10) {
        shortText = speakText.slice(0, 120).trim();
      }

      // Add a polite indicator if the response was truncated
      if (shortText.length < speakText.length) {
        shortText += "... Please see the details in the chat window.";
      }

      if (!shortText.trim()) return;

      const res = await fetch(`${API_BASE}/chat/tts`, {
        method: 'POST',
        headers: getJsonHeaders(),
        credentials: 'include',
        body: JSON.stringify({ text: shortText }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        activeAudioRef.current = audio;
        setIsPlayingAudio(true);
        audio.onended = () => {
          setIsPlayingAudio(false);
          activeAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          activeAudioRef.current = null;
        };
        audio.play().catch(console.error);
      }
    } catch (e) {
      console.error('Failed to play TTS', e);
    }
  };

  const sendMessage = async (content: string, isVoice = false) => {
    if (!content.trim()) return;
    const userMessage: Message = { id: Date.now().toString(), content: content.trim(), sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');


    // ── Natural-language rename detection (works any time, even during normal chat) ─
    const _renameTarget = detectRenameIntent(content);
    if (_renameTarget) {
      applyRenameHelper(_renameTarget, setCurrentAiName);
      const confirmation = `✨ Done! From now on, I'm **${_renameTarget}**. How can I help you today?`;
      setMessages(prev => [...prev, {
        id: `rename-${Date.now()}`,
        content: confirmation,
        sender: 'bot' as const,
        timestamp: new Date(),
      }]);
      return;
    }

    // (Onboarding handled via popup -- see JSX overlay below)

    if (contactStage === 'name') {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), content: "I'd love to help! But first, could you please share your name?", sender: 'bot', timestamp: new Date() }]);
      return;
    }
    if (contactStage === 'email') {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), content: 'Could you please share your email address?', sender: 'bot', timestamp: new Date() }]);
      return;
    }

    setIsTyping(true);
    try {
      const requestBody: any = { message: content, context: 'customer_support', sessionId };
      if (isContactSubmitted && !isLoggedIn) requestBody.customerInfo = customerInfo;

      // Include identity from the persisted auth store so the backend can
      // set up agent tools even when the in-memory accessToken hasn't been
      // refreshed yet (it is not persisted to localStorage by design).
      if (isLoggedIn && authWorkspaceId && authUser) {
        requestBody.workspaceId = authWorkspaceId;
        requestBody.userId = authUser.id;
      }

      const response = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: getJsonHeaders(),
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      const data = await response.json();

      if (data.needsTransfer) {
        setNeedsTransfer(true);
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), content: data.message || 'Let me connect you with a human agent.', sender: 'bot', timestamp: new Date() }]);
        setBotResponseCount(prev => prev + 1);
        setTimeout(() => handleTransferToAgent(), 1000);
      } else if (data.response) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), content: data.response, sender: 'bot', timestamp: new Date(), sources: data.sources || [] }]);
        const newCount = botResponseCount + 1;
        setBotResponseCount(newCount);
        
        if (isVoice) {
          playTTS(data.response);
        }
        
        // Only prompt for contact info for unauthenticated users
        if (!isLoggedIn && !isContactSubmitted && contactStage === 'none' && newCount >= 2) {
          setTimeout(() => {
            setMessages(prev => [...prev, { id: (Date.now() + 5).toString(), content: 'For better personalized assistance, may I know your name?', sender: 'bot', timestamp: new Date() }]);
            setContactStage('name');
          }, 500);
        }
      }
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), content: "I'm sorry, I'm having trouble connecting. Please try again in a moment.", sender: 'bot', timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(inputMessage, false); };

  // Trigger onboarding popup for new logged-in users
  useEffect(() => {
    if (isOpen && isLoggedIn && authUser && !isOnboardingDone() && !onboardingPopupOpen) {
      const t = setTimeout(() => {
        setOnboardingPopupOpen(true);
        setOnboardingPopupStep(0);
        setOnboardingPopupInput('');
        setOnboardingMultiSel([]);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isOpen, isLoggedIn, authUser]);


  // ── Onboarding popup handlers ──────────────────────────────────────────────
  const _obStep     = ONBOARDING_STEPS[onboardingPopupStep];
  const _obIsLast   = onboardingPopupStep === ONBOARDING_STEPS.length - 1;
  const _obIsMulti  = _obStep?.inputType === 'multi-chips';
  const _obCanNext  = _obIsMulti
    ? onboardingMultiSel.length > 0
    : onboardingPopupInput.trim().length > 0;

  const obCommitAndAdvance = (answer: string) => {
    const newAnswers = { ...onboardingAnswers, [(_obStep?.key || '')]: answer };
    setOnboardingAnswers(newAnswers);
    if (answer) saveStoredPrefs({ [_obStep?.key || '']: answer });
    if (_obIsLast) {
      const rawName = _obStep?.key === 'aiName' ? answer : (newAnswers.aiName || '');
      const nameToUse = rawName.trim() || (currentAiName !== 'SmmtAI Assistant' ? currentAiName : '');
      if (nameToUse) { setCurrentAiName(nameToUse); saveStoredPrefs({ aiName: nameToUse }); }
      localStorage.setItem(ONBOARDING_DONE_KEY, '1');
      localStorage.setItem('smmtai_onboarding_dismissed', 'true');
      setOnboardingPopupOpen(false);
      setOnboardingActive(false);
      syncPrefsToServer({ ...newAnswers, aiName: nameToUse, onboardingComplete: true });
      setMessages(prev => [...prev, {
        id: 'ob-done-' + Date.now(),
        content: buildCompletionMessage(newAnswers, nameToUse, authUser?.name || ''),
        sender: 'bot' as const,
        timestamp: new Date(),
      }]);
    } else {
      setOnboardingPopupStep(s => s + 1);
      setOnboardingPopupInput('');
      setOnboardingMultiSel([]);
    }
  };

  const obHandleNext     = () => obCommitAndAdvance(_obIsMulti ? onboardingMultiSel.join(', ') : onboardingPopupInput.trim());
  const obHandleSkipStep = () => obCommitAndAdvance('');
  const obHandleSkipAll  = () => {
    localStorage.setItem(ONBOARDING_DONE_KEY, '1');
    localStorage.setItem('smmtai_onboarding_dismissed', 'true');
    setOnboardingPopupOpen(false);
    setOnboardingActive(false);
    if (Object.keys(onboardingAnswers).length > 0) {
      syncPrefsToServer({ ...onboardingAnswers, onboardingComplete: false });
    }
  };

  // ── Onboarding popup JSX (rendered as variable, NOT an IIFE) ──────────────
  const onboardingPopupJSX = onboardingPopupOpen && _obStep ? (
    <div
      className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(4px)', borderRadius: 'inherit' }}
    >
      <div
        className="w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl"
        style={{ maxHeight: '94%', display: 'flex', flexDirection: 'column' }}
      >
        {/* Popup Header */}
        <div className="bg-brand-blue px-4 py-3 rounded-t-2xl flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium">Personalizing your experience</p>
            <p className="text-white font-bold text-sm">Step {onboardingPopupStep + 1} of {ONBOARDING_STEPS.length}</p>
          </div>
          <button
            onClick={obHandleSkipAll}
            className="text-white/60 hover:text-white text-xs underline underline-offset-2 transition-colors"
          >
            Skip setup
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 px-4 pt-3">
          {ONBOARDING_STEPS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all duration-300"
              style={{ background: i <= onboardingPopupStep ? '#2563eb' : '#e5e7eb' }}
            />
          ))}
        </div>

        {/* Step body */}
        <div className="px-4 py-4 flex-1 overflow-y-auto">
          <div className="text-center mb-5">
            <div className="text-4xl mb-2">{_obStep.emoji}</div>
            <h3 className="font-bold text-neutral-800 dark:text-neutral-100 text-base leading-snug">
              {_obStep.title}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-1">{_obStep.subtitle}</p>
          </div>

          {/* Chip options */}
          {(_obStep.inputType === 'chips' || _obStep.inputType === 'multi-chips') && _obStep.options && (
            <div className="flex flex-wrap gap-2 justify-center">
              {_obStep.options.map(opt => {
                const sel = _obIsMulti ? onboardingMultiSel.includes(opt) : onboardingPopupInput === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      if (_obIsMulti) {
                        setOnboardingMultiSel(prev =>
                          prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
                        );
                      } else {
                        setOnboardingPopupInput(sel ? '' : opt);
                      }
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 select-none"
                    style={{
                      background:   sel ? '#2563eb' : 'transparent',
                      color:        sel ? '#fff'     : '#374151',
                      borderColor:  sel ? '#2563eb'  : '#d1d5db',
                      transform:    sel ? 'scale(1.06)' : 'scale(1)',
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Free-text input */}
          {_obStep.inputType === 'text' && (
            <input
              autoFocus
              type="text"
              value={onboardingPopupInput}
              onChange={e => setOnboardingPopupInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && _obCanNext) obHandleNext(); }}
              placeholder={_obStep.placeholder}
              maxLength={80}
              className="w-full border border-neutral-200 dark:border-neutral-600 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
            />
          )}

          {/* Date input */}
          {_obStep.inputType === 'date' && (
            <div className="space-y-2">
              <input
                autoFocus
                type="date"
                onChange={e => setOnboardingPopupInput(e.target.value)}
                className="w-full border border-neutral-200 dark:border-neutral-600 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-center text-xs text-neutral-400">or type it below</p>
              <input
                type="text"
                value={onboardingPopupInput}
                onChange={e => setOnboardingPopupInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && _obCanNext) obHandleNext(); }}
                placeholder="e.g. April 15, 1995"
                maxLength={30}
                className="w-full border border-neutral-200 dark:border-neutral-600 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-1 flex items-center gap-2">
          <button
            onClick={obHandleSkipStep}
            className="flex-1 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-600 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
          >
            Skip this
          </button>
          <button
            onClick={obHandleNext}
            disabled={!_obCanNext}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-all duration-200"
            style={{
              background: _obCanNext ? '#2563eb' : '#9ca3af',
              cursor:     _obCanNext ? 'pointer' : 'not-allowed',
              transform:  _obCanNext ? 'scale(1)' : 'scale(0.97)',
            }}
          >
            {_obIsLast ? '🎉 Finish!' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-300 flex items-center justify-center hover:scale-110 active:scale-95"
        aria-label="Open AI Chat"
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 z-50 sm:w-96 h-[500px] max-h-[70vh] bg-blue-50 dark:bg-neutral-900 rounded-2xl shadow-2xl border border-blue-100 dark:border-neutral-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="relative flex flex-col h-full w-full">
          {/* Header */}
          <div className="bg-brand-blue text-white p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                {isEditingName ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editNameValue.trim()) {
                        applyRenameHelper(editNameValue.trim(), setCurrentAiName);
                      }
                      setIsEditingName(false);
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      autoFocus
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setIsEditingName(false); }}
                      maxLength={40}
                      placeholder="Enter AI name…"
                      className="text-sm font-semibold bg-white/20 text-white placeholder-white/60 border border-white/40 rounded px-2 py-0.5 w-36 focus:outline-none focus:ring-1 focus:ring-white/60"
                    />
                    <button type="submit" className="p-0.5 hover:bg-white/20 rounded transition-colors" aria-label="Save name">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => setIsEditingName(false)} className="p-0.5 hover:bg-white/20 rounded transition-colors" aria-label="Cancel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => { setEditNameValue(currentAiName || 'SmmtAI Assistant'); setIsEditingName(true); }}>
                    <h3 className="font-semibold text-sm">{currentAiName || 'SmmtAI Assistant'}</h3>
                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                  </div>
                )}
                <p className="text-xs opacity-90">Online now</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors" aria-label="Minimize chat">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {onboardingPopupJSX}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-2 sm:gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.sender === 'bot' && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-brand-blue rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2 ${message.sender === 'user' ? 'bg-brand-blue text-white' : 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'}`}>
                  <div className="text-sm leading-relaxed">{renderMessageContent(message.content)}</div>
                  <p className={`text-[10px] sm:text-xs mt-1 ${message.sender === 'user' ? 'text-blue-100' : 'text-neutral-500'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {message.sender === 'user' && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-neutral-400 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Name Input */}
            {contactStage === 'name' && (
              <div className="bg-white dark:bg-neutral-800 border-2 border-brand-blue rounded-2xl p-4 shadow-lg">
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-brand-blue" /> What's your name?
                </h4>
                <form onSubmit={handleNameSubmit} className="space-y-3">
                  <input type="text" placeholder="Enter your name" value={customerInfo.name}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    autoFocus required />
                  <button type="submit" className="w-full bg-brand-blue text-white py-2 rounded-lg text-sm font-medium hover:shadow-lg transition-all">Continue</button>
                </form>
              </div>
            )}

            {/* Email Input */}
            {contactStage === 'email' && (
              <div className="bg-white dark:bg-neutral-800 border-2 border-brand-blue rounded-2xl p-4 shadow-lg">
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-blue" /> What's your email?
                </h4>
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <input type="email" placeholder="Enter your email" value={customerInfo.email}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    autoFocus required />
                  <button type="submit" className="w-full bg-brand-blue text-white py-2 rounded-lg text-sm font-medium hover:shadow-lg transition-all">Continue</button>
                </form>
              </div>
            )}

            {/* Transfer Button */}
            {needsTransfer && (
              <div className="flex justify-center">
                <button onClick={handleTransferToAgent}
                  className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:shadow-lg transition-all flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Connect to Live Agent
                </button>
              </div>
            )}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 bg-brand-blue rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-neutral-200 dark:border-neutral-700 p-3 sm:p-4">
            {/* Recording status bar */}
            {isRecording && (
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-500 font-medium">
                    Recording… {recordingSeconds}s
                  </span>
                </div>
                <span className="text-xs text-neutral-400">Tap mic to stop</span>
              </div>
            )}
            {isTranscribing && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                <span className="text-xs text-blue-500">Transcribing…</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input ref={inputRef} type="text" value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={isRecording ? 'Listening…' : isTranscribing ? 'Transcribing…' : 'Type or use voice…'}
                className="flex-1 px-3 sm:px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500"
                disabled={isTyping || contactStage !== 'none' || isRecording || isTranscribing} />

              {/* Microphone button */}
              <button
                type="button"
                onClick={startRecording}
                disabled={isTyping || contactStage !== 'none' || isTranscribing}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  isRecording
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 scale-110 animate-pulse'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40'
                }`}
                aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                title={isRecording ? 'Tap to stop recording' : 'Voice input'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Stop-speaking button — only shown while bot is reading aloud */}
              {isPlayingAudio && (
                <button
                  type="button"
                  onClick={stopAudio}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-500 text-white shadow-lg shadow-orange-500/40 hover:bg-orange-600 transition-all shrink-0 animate-pulse"
                  aria-label="Stop speaking"
                  title="Stop speaking"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              )}

              {/* Send button */}
              <button type="submit" disabled={!inputMessage.trim() || isTyping || contactStage !== 'none' || isRecording}
                className="w-10 h-10 bg-brand-blue text-white rounded-full hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all shrink-0"
                aria-label="Send message">
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] sm:text-xs text-neutral-500 mt-2 text-center">Powered by SmmtAI AI</p>
          </div>
          </div>
        </div>
      )}
    </>
  );
}
