import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2, Phone, Mail, UserIcon } from 'lucide-react';

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

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', content: "Hi! I'm your Postmind assistant. I can help you with questions about social media management, scheduling, analytics, and more. How can I help?", sender: 'bot', timestamp: new Date() },
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

  useEffect(() => {
    const init = async () => {
      const existing = localStorage.getItem('pmChatSessionId');
      if (existing) {
        setSessionId(existing);
        const saved = localStorage.getItem('pmChatCustomerInfo');
        if (saved) {
          try { setCustomerInfo(JSON.parse(saved)); setIsContactSubmitted(true); } catch {}
        }
        try {
          const res = await fetch(`${API_BASE}/chat/conversations/history/${existing}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
              const loaded = data.messages.map((msg: any, idx: number) => ({
                id: `loaded-${idx}`, content: msg.content, sender: msg.role as 'user' | 'bot', timestamp: new Date(msg.timestamp), sources: msg.sources,
              }));
              setMessages([
                { id: '1', content: "Hi! I'm your Postmind assistant. I can help you with questions about social media management, scheduling, analytics, and more. How can I help?", sender: 'bot', timestamp: new Date() },
                ...loaded,
              ]);
            }
          }
        } catch {}
      } else {
        const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        setSessionId(newId);
        localStorage.setItem('pmChatSessionId', newId);
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  const sendMessage = async (content: string) => {
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
      if (isContactSubmitted) requestBody.customerInfo = customerInfo;

      const response = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody),
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
        if (!isContactSubmitted && contactStage === 'none' && newCount >= 2) {
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

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(inputMessage); };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 bg-brand-blue rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-center hover:scale-110 active:scale-95"
        aria-label="Open AI Chat"
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 z-50 sm:w-96 h-[500px] max-h-[70vh] bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-brand-blue text-white p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Postmind Assistant</h3>
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
                <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2 ${message.sender === 'user' ? 'bg-brand-blue text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'}`}>
                  <p className="text-sm leading-relaxed">{message.content}</p>
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
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input ref={inputRef} type="text" value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-3 sm:px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500"
                disabled={isTyping || contactStage !== 'none'} />
              <button type="submit" disabled={!inputMessage.trim() || isTyping || contactStage !== 'none'}
                className="w-10 h-10 bg-brand-blue text-white rounded-full hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                aria-label="Send message">
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] sm:text-xs text-neutral-500 mt-2 text-center">Powered by Postmind AI</p>
          </div>
        </div>
      )}
    </>
  );
}
