import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import {
  Bot, Send, Loader2, Settings2, Globe, Cpu, Layers, User, Wifi
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const MODES = [
  { id: "local", label: "Local", icon: Cpu, desc: "Ollama (offline)" },
  { id: "online", label: "Online", icon: Globe, desc: "OpenAI GPT" },
  { id: "both", label: "Both", icon: Layers, desc: "Local + Online" },
];

const SAMPLE_QUESTIONS = [
  "What could cause a PoE camera to go offline?",
  "How do I bounce an SNMP port on SW-Bridge?",
  "What is the UPS battery threshold for alarms?",
  "Show me the troubleshooting steps for high CPU on a switch.",
];

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

export default function AssistantPage() {
  const [mode, setMode] = useState("online");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm Guardian AI, your onboard AV/IT assistant. I can help you troubleshoot network issues, diagnose equipment faults, and search your technical documents. How can I help today?",
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content }]);
    setLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Guardian AI, an expert assistant for luxury yacht and high-end residential AV/IT systems — networking, AV, control, lighting, CCTV, and power. Answer concisely and practically. If relevant, mention specific troubleshooting steps.\n\nUser: ${content}`,
      });
      setMessages(prev => [...prev, { role: "assistant", content: res }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm unable to respond right now. Please check your OpenAI API key in **Settings → AI**.",
      }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border/50 bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Bot size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Guardian Assistant</p>
            <p className="text-xs text-muted-foreground">AI-powered AV/IT support</p>
          </div>
        </div>
        {/* Mode selector */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
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

      {/* Sample questions */}
      {messages.length <= 1 && (
        <div className="px-4 md:px-6 pb-3 flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 rounded-full px-3 py-1.5 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 md:px-6 py-3 border-t border-border/50 bg-card/50 flex-shrink-0">
        <form
          onSubmit={e => { e.preventDefault(); sendMessage(); }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
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
    </div>
  );
}