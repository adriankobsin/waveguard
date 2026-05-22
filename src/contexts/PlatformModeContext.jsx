import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  DEFAULT_PLATFORM_MODE,
  PLATFORM_MODE_CHANGED_EVENT,
  PLATFORM_MODES,
  loadPlatformModeLocal,
} from "@/lib/platformMode";
import { loadPlatformMode, savePlatformMode } from "@/api/platformModeApi";

const PlatformModeContext = createContext(null);

export function PlatformModeProvider({ children }) {
  const [state, setState] = useState(() => loadPlatformModeLocal() || DEFAULT_PLATFORM_MODE);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadPlatformMode();
        if (!cancelled) setState(loaded);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onChange = (e) => {
      if (e?.detail) setState(e.detail);
      else setState(loadPlatformModeLocal() || DEFAULT_PLATFORM_MODE);
    };
    window.addEventListener(PLATFORM_MODE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PLATFORM_MODE_CHANGED_EVENT, onChange);
  }, []);

  const setMode = useCallback(async (mode) => {
    setSaving(true);
    try {
      const saved = await savePlatformMode({ mode });
      setState(saved);
      return saved;
    } finally {
      setSaving(false);
    }
  }, []);

  const isDemo = state.mode === PLATFORM_MODES.DEMO;

  return (
    <PlatformModeContext.Provider value={{ mode: state.mode, isDemo, setMode, ready, saving }}>
      {children}
    </PlatformModeContext.Provider>
  );
}

export function usePlatformMode() {
  const ctx = useContext(PlatformModeContext);
  if (!ctx) {
    return { mode: PLATFORM_MODES.LIVE, isDemo: false, setMode: async () => {}, ready: true, saving: false };
  }
  return ctx;
}
