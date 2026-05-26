import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2, Phone, Mail, UserIcon, Mic, MicOff, Loader2 } from 'lucide-react';
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

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);

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

  const greeting = isLoggedIn && authUser
    ? `Hi ${authUser.name}! 👋 I'm your SmmtAI assistant. I have full visibility into your workspace — ask me about your posts, analytics, drafts, or just tell me to do something!`
    : "Hi! I'm your SmmtAI assistant. I can help you with questions about social media management, scheduling, analytics, and more. How can I help?";

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
        ? `Hi ${authUser.name}! 👋 I'm your SmmtAI assistant. I have full visibility into your workspace — ask me about your posts, analytics, drafts, or just tell me to do something!`
        : "Hi! I'm your SmmtAI assistant. I can help you with questions about social media management, scheduling, analytics, and more. How can I help?";

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
    if (!isContactSubmitted && contactStage === 'none') {
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
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 z-50 sm:w-96 h-[500px] max-h-[70vh] bg-blue-50 dark:bg-neutral-900 rounded-2xl shadow-2xl border border-blue-100 dark:border-neutral-700 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-brand-blue text-white p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">SmmtAI Assistant</h3>
                <p className="text-xs opacity-90">Online now</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors" aria-label="Minimize chat">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

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
      )}
    </>
  );
}
