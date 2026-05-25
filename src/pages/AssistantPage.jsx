import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, Send, Loader2, Globe, Cpu, Layers, User, Plus, Trash2, PanelLeftClose, PanelLeft, MessageSquare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  loadSessions, saveSessions, createSession, deleteSession, updateSession,
} from "@/lib/chatStorage";

const MODES = [
  { id: "local", label: "Local", icon: Cpu, desc: "Ollama (offline)" },
  { id: "online", label: "Online", icon: Globe, desc: "OpenAI GPT" },
  { id: "both", label: "Both", icon: Layers, desc: "Local + Online" },
];

const SAMPLE_QUESTIONS = [
  "What equipment is currently on my network?",
  "Are there any devices with warnings or offline?",
  "Show me the latest WAN speed test results",
  "What could cause a PoE camera to go offline?",
];

const WELCOME_MSG = {
  role: "assistant",
  content: "Hello! I'm Wave Guard, your onboard AV/IT assistant. I can help you troubleshoot network issues, diagnose equipment faults, and search your technical documents. How can I help today?",
};

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={13} className="text-primary" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-card border border-border text-foreground"
      }`}>
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
              code: ({ inline, children }) => inline
                ? <code className="bg-secondary px-1 py-0.5 rounded text-xs">{children}</code>
                : <pre className="bg-secondary rounded-lg p-3 text-xs overflow-auto my-2"><code>{children}</code></pre>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
        {msg.citation && (
          <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-1">
            <span>📄</span>
            <span>{msg.citation}</span>
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={13} className="text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function WelcomeScreen({ onSend }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
        <Bot size={28} className="text-primary" />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-1">Wave Guard Assistant</h1>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
        AI-powered AV/IT support for your network. Ask about equipment, events, or troubleshooting.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSend(q)}
            className="text-xs bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 rounded-full px-3 py-1.5 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const [sessions, setSessions] = useState(() => loadSessions());
  const [activeId, setActiveId] = useState(null);
  const [localMessages, setLocalMessages] = useState([]);
  const [localMode, setLocalMode] = useState("online");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const fetchIdRef = useRef(0);

  const active = activeId ? sessions.find((s) => s.id === activeId) : null;
  const messages = activeId ? localMessages : [];
  const mode = active?.mode ?? localMode;

  // When switching to an existing session, load its messages
  const loadSessionMessages = useCallback((id) => {
    const s = sessionsRef.current.find((x) => x.id === id);
    if (s) {
      setLocalMessages(s.messages);
      setLocalMode(s.mode);
    }
  }, []);

  // Sync localMessages to the active session in sessions + persist
  const syncToSession = useCallback((newMessages) => {
    const id = activeId;
    if (!id) return;
    setSessions((prev) => {
      const updated = updateSession(prev, id, { messages: newMessages });
      saveSessions(updated);
      return updated;
    });
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const switchChat = useCallback((id) => {
    setActiveId(id);
    setInput("");
    setLoading(false);
    loadSessionMessages(id);
  }, [loadSessionMessages]);

  const newChat = useCallback(() => {
    setActiveId(null);
    setLocalMessages([]);
    setInput("");
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const removeChat = useCallback((e, id) => {
    e.stopPropagation();
    setSessions((prev) => {
      const updated = deleteSession(prev, id);
      saveSessions(updated);
      return updated;
    });
    if (activeId === id) newChat();
  }, [activeId, newChat]);

  const sendMessage = useCallback(async (text) => {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput("");

    let currentId = activeId;
    let currentMode = mode;
    let currentMessages = messages;

    if (!currentId) {
      currentMode = localMode;
      const s = createSession(currentMode);
      s.title = content.length > 40 ? content.slice(0, 40) + "…" : content;
      const userMsg = { role: "user", content };
      s.messages = [WELCOME_MSG, userMsg];

      currentId = s.id;
      currentMessages = s.messages;
      setLocalMessages(s.messages);

      setSessions((prev) => {
        const updated = [...prev, s];
        saveSessions(updated);
        return updated;
      });
      setActiveId(s.id);
    } else {
      const userMsg = { role: "user", content };
      const nextMessages = [...messages, userMsg];
      currentMessages = nextMessages;
      setLocalMessages(nextMessages);
      syncToSession(nextMessages);

      // Auto-title on first user message
      if (messages.length <= 1) {
        const title = content.length > 40 ? content.slice(0, 40) + "…" : content;
        setSessions((prev) => {
          const updated = updateSession(prev, currentId, { title });
          saveSessions(updated);
          return updated;
        });
      }
    }

    const thisFetch = ++fetchIdRef.current;
    setLoading(true);

    try {
      const msgHistory = currentMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content, mode: currentMode, conversation: msgHistory }),
      });
      const data = await res.json();

      if (fetchIdRef.current !== thisFetch) return;

      let reply;
      if (data.needsKey) {
        reply = "⚠️ **OpenAI API key not configured.**\n\nThe platform operator can set the key in two ways:\n1. **Settings → AI** inside this app\n2. Environment variable `OPENAI_API_KEY` on the server\n\n**Local mode** (Ollama) doesn't need an API key — install Ollama on the server with `ollama pull llama3.2` and switch to Local mode.";
      } else if (data.error) {
        reply = `⚠️ ${data.error}`;
      } else {
        reply = data.response;
      }

      const finalMessages = [...currentMessages, { role: "assistant", content: reply }];
      setLocalMessages(finalMessages);

      setSessions((prev) => {
        const updated = updateSession(prev, currentId, { messages: finalMessages });
        saveSessions(updated);
        return updated;
      });
    } catch (e) {
      if (fetchIdRef.current !== thisFetch) return;
      const fallback = "I'm unable to reach the AI service. Make sure the chat server is running (`pm2 status waveguard-chat`).";
      const finalMessages = [...currentMessages, { role: "assistant", content: fallback }];
      setLocalMessages(finalMessages);

      setSessions((prev) => {
        const updated = updateSession(prev, currentId, { messages: finalMessages });
        saveSessions(updated);
        return updated;
      });
    }

    setLoading(false);
  }, [input, loading, activeId, mode, messages, localMode, syncToSession]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const setActiveMode = (modeId) => {
    if (activeId) {
      setLocalMode(modeId);
      setSessions((prev) => {
        const updated = updateSession(prev, activeId, { mode: modeId });
        saveSessions(updated);
        return updated;
      });
    } else {
      setLocalMode(modeId);
    }
  };

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <div className={`flex-shrink-0 border-r border-border/50 bg-card/30 flex flex-col transition-all duration-200 ${
        sidebarOpen ? "w-60" : "w-0 overflow-hidden"
      }`}>
        <div className="p-3">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <Plus size={14} />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => switchChat(s.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                s.id === activeId
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <MessageSquare size={13} className="flex-shrink-0" />
              <span className="truncate flex-1">{s.title}</span>
              <button
                onClick={(e) => removeChat(e, s.id)}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                title="Delete chat"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
            </button>
            {active && (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Bot size={14} className="text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{active.title}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMode(m.id)}
                title={m.desc}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <m.icon size={12} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {!activeId ? (
          <WelcomeScreen onSend={sendMessage} />
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
              {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Bot size={13} className="text-primary" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 md:px-6 py-3 border-t border-border/50 bg-card/50 flex-shrink-0">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your AV/IT systems…"
                  className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
