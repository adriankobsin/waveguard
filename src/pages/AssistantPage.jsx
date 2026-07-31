import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, Send, Loader2, Globe, Cpu, Layers, User, Plus, Trash2, PanelLeftClose, PanelLeft, MessageSquare, Circle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  loadSessions, saveSessions, createSession, deleteSession, updateSession,
} from "@/lib/chatStorage";

const MODES = [
  { id: "local", label: "Local", icon: Cpu, desc: "Offline agent + Ollama when available" },
  { id: "online", label: "Online", icon: Globe, desc: "OpenAI GPT (requires API key)" },
  { id: "both", label: "Both", icon: Layers, desc: "OpenAI + local" },
];

const SAMPLE_QUESTIONS = [
  "What equipment is currently on my network?",
  "Are there any devices with warnings or offline?",
  "Show me the latest WAN speed test results",
  "What could cause a PoE camera to go offline?",
];

const WELCOME_MSG = {
  role: "assistant",
  content: "Hello! I'm Wave Guard, your onboard AV/IT assistant. In **Local** mode I use live platform data for troubleshooting — no internet required. Ask about equipment status, offline devices, PoE faults, or WAN performance.",
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
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 min-h-0">
      <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
        <Bot size={28} className="text-primary" />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-1">Wave Guard Assistant</h1>
      <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
        AI-powered AV/IT support using your live equipment data. Local mode works offline for troubleshooting and guidance.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
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

function ChatInputBar({ input, setInput, loading, onSend, inputRef }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="px-4 md:px-6 py-3 border-t border-border/50 bg-card/50 flex-shrink-0">
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="flex gap-2 max-w-4xl mx-auto"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about equipment, faults, or troubleshooting…"
          className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

function AgentStatus({ health, mode }) {
  if (!health) return null;
  const localReady = health.offlineAgent || health.ollama;
  const label =
    mode === "online"
      ? health.openai ? "OpenAI connected" : "OpenAI key missing"
      : localReady
        ? health.ollama ? "Ollama + platform data" : "Offline agent (platform data)"
        : "Platform data unavailable";

  const ok = mode === "online" ? health.openai : health.offlineAgent;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <Circle size={8} className={ok ? "text-emerald-500 fill-emerald-500" : "text-amber-500 fill-amber-500"} />
      <span>{label}</span>
    </div>
  );
}

export default function AssistantPage() {
  const [sessions, setSessions] = useState(() => loadSessions());
  const [activeId, setActiveId] = useState(null);
  const [localMessages, setLocalMessages] = useState([]);
  const [localMode, setLocalMode] = useState("local");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [health, setHealth] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const fetchIdRef = useRef(0);

  const active = activeId ? sessions.find((s) => s.id === activeId) : null;
  const messages = activeId ? localMessages : [];
  const mode = active?.mode ?? localMode;

  useEffect(() => {
    fetch("/chat/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loadSessionMessages = useCallback((id) => {
    const s = sessionsRef.current.find((x) => x.id === id);
    if (s) {
      setLocalMessages(s.messages);
      setLocalMode(s.mode);
    }
  }, []);

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
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      if (fetchIdRef.current !== thisFetch) return;

      let reply;
      if (data.needsKey) {
        reply = "⚠️ **OpenAI API key not configured.**\n\nSwitch to **Local** mode for offline troubleshooting (uses live platform data), or add your key in **Settings → AI & OpenAI**.";
      } else if (data.error) {
        reply = `⚠️ ${data.error}`;
      } else {
        reply = data.response;
        if (data.engine === "offline-agent") {
          reply = "_Offline agent · live platform data_\n\n" + reply;
        }
      }

      const finalMessages = [...currentMessages, { role: "assistant", content: reply }];
      setLocalMessages(finalMessages);

      setSessions((prev) => {
        const updated = updateSession(prev, currentId, { messages: finalMessages });
        saveSessions(updated);
        return updated;
      });
    } catch {
      if (fetchIdRef.current !== thisFetch) return;
      const fallback = "⚠️ Could not reach the assistant service. Ensure the dev server is running (`npm run dev:all`).";
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
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 bg-background">
      {/* Sidebar */}
      <div className={`flex-shrink-0 border-r border-border/50 bg-card/30 flex flex-col transition-all duration-200 ${
        sidebarOpen ? "w-60" : "w-0 overflow-hidden"
      }`}>
        <div className="p-3">
          <button
            type="button"
            onClick={newChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <Plus size={14} />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 min-h-0">
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
                type="button"
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
            </button>
            <div className="min-w-0">
              {active ? (
                <p className="text-sm font-medium text-foreground truncate">{active.title}</p>
              ) : (
                <p className="text-sm font-medium text-foreground">New conversation</p>
              )}
              <AgentStatus health={health} mode={mode} />
            </div>
          </div>
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 flex-shrink-0">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
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

        {/* Messages or welcome */}
        {!activeId ? (
          <WelcomeScreen onSend={sendMessage} />
        ) : (
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 min-h-0">
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
        )}

        {/* Chat input — always visible */}
        <ChatInputBar
          input={input}
          setInput={setInput}
          loading={loading}
          onSend={() => sendMessage()}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
