const STORAGE_KEY = "waveguard_chat_sessions";

export function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

export function createSession(mode) {
  return {
    id: "chat_" + Date.now(),
    title: "New chat",
    mode: mode || "online",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        role: "assistant",
        content: "Hello! I'm Wave Guard, your onboard AV/IT assistant. I can help you troubleshoot network issues, diagnose equipment faults, and search your technical documents. How can I help today?",
      },
    ],
  };
}

export function deleteSession(sessions, id) {
  return sessions.filter((s) => s.id !== id);
}

export function updateSession(sessions, id, patch) {
  return sessions.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s));
}
