import { useEffect, useRef, useState } from 'react';
import { Send, Search, MessageCircle, ShieldCheck, GraduationCap, UserCog } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, btnPrimary, inputCls } from '../../components/ui/UI';

const roleIcon = { STUDENT: GraduationCap, FACULTY: ShieldCheck, ADMIN: UserCog };
const roleTone = {
  STUDENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
  FACULTY: 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300',
  ADMIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
};

export default function Messages() {
  const { user } = useAuth();
  const [peers, setPeers] = useState(null);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(new Set());
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  async function loadPeers() {
    try {
      const res = await api.get('/chat/peers');
      setPeers(res.data.peers);
    } catch (err) {
      setError(apiMessage(err));
      setPeers([]);
    }
  }

  useEffect(() => {
    loadPeers();
    const t = setInterval(() => {
      loadPeers();
      if (activeRef.current) {
        api
          .get(`/chat/messages/${activeRef.current.id}`)
          .then((res) => setMessages(res.data.messages))
          .catch(() => {});
      }
    }, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      const message = event.detail;
      if (message?.senderId === activeRef.current?.id) {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        loadPeers();
      }
    };
    const onTyping = (event) => {
      if (event.detail?.userId === activeRef.current?.id) setTyping(Boolean(event.detail.typing));
    };
    const onPresence = (event) => setOnline(new Set(event.detail?.onlineUsers || []));
    window.addEventListener('portal:chat.message', onMessage);
    window.addEventListener('portal:typing', onTyping);
    window.addEventListener('portal:presence', onPresence);
    return () => {
      window.removeEventListener('portal:chat.message', onMessage);
      window.removeEventListener('portal:typing', onTyping);
      window.removeEventListener('portal:presence', onPresence);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    api
      .get(`/chat/messages/${active.id}`)
      .then((res) => setMessages(res.data.messages))
      .catch((err) => setError(apiMessage(err)));
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    if (!draft.trim() || !active) return;
    setSending(true);
    setError('');
    try {
      const res = await api.post(`/chat/messages/${active.id}`, { body: draft.trim() });
      setMessages((m) => [...m, res.data.message]);
      setDraft('');
      loadPeers();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setSending(false);
    }

    function updateDraft(value) {
      setDraft(value);
      if (active) {
        window.portalRealtimeSend?.('typing', { userId: active.id, typing: Boolean(value.trim()) });
        window.clearTimeout(updateDraft.timer);
        updateDraft.timer = window.setTimeout(() => window.portalRealtimeSend?.('typing', { userId: active.id, typing: false }), 1000);
      }
    }
  }

  if (!peers) return <Spinner label="Loading messages..." />;

  const filtered = peers.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.meta || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Messages</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Direct messaging between students, faculty, and administration
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[520px]">
        <Card title="Conversations" subtitle={`${peers.length} contacts`} className="lg:col-span-1">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              aria-label="Search people"
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls + ' pl-9 py-1.5 text-sm'}
            />
          </div>
          <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
            {filtered.map((p) => {
              const Icon = roleIcon[p.role] || MessageCircle;
              return (
                <button
                  key={p.id}
                  aria-label={`Open conversation with ${p.name}`}
                  onClick={() => setActive(p)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 border transition ${
                    active?.id === p.id
                      ? 'border-brand-600 bg-brand-50 dark:bg-slate-800'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${roleTone[p.role]}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                          {p.name}{p.id === user.id ? ' (you)' : ''}
                        </span>
                        {p.unread > 0 && (
                          <span className="min-w-4 h-4 px-1 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center">
                            {p.unread}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex justify-between gap-2">
                        <span className="truncate">{p.meta || p.email}</span>
                        <span className="uppercase">{p.role}</span>
                      </div>
                      {p.lastMessage && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {p.lastMessage}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No contacts found</p>
            )}
          </div>
        </Card>

        <Card
          className="lg:col-span-2 flex flex-col"
          title={active ? active.name : 'Select a conversation'}
          subtitle={active ? `${active.role} · ${active.email}${online.has(active.id) ? ' · Online' : ' · Offline'}` : 'Choose a contact'}
        >
          {!active ? (
            <div className="py-16 text-center text-slate-400">
              <MessageCircle className="mx-auto mb-3" size={36} />
              <p className="text-sm">Choose a contact to start messaging</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 max-h-[380px] pr-1 mb-4">
                {messages.map((m) => {
                  const mine = m.senderId === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          mine
                            ? 'bg-brand-600 text-white rounded-br-md'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <div className={`text-[10px] mt-1 ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {mine && m.readAt && ' · read'}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-6">No messages yet — say hello!</p>
                )}
                {typing && <p className="text-xs text-slate-400" aria-live="polite">{active.name} is typing…</p>}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} className="flex gap-2">
                <input
                  aria-label={`Message ${active.name}`}
                  value={draft}
                  onChange={(e) => updateDraft(e.target.value)}
                  placeholder={`Message ${active.name}...`}
                  className={inputCls + ' flex-1'}
                  maxLength={2000}
                />
                <button type="submit" disabled={sending || !draft.trim()} className={btnPrimary}>
                  <Send size={15} /> Send
                </button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
