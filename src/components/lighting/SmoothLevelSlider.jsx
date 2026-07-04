import { memo, useCallback, useEffect, useRef } from "react";

const compareInner = (prev, next) =>
  prev.disabled === next.disabled &&
  prev.min === next.min &&
  prev.max === next.max &&
  prev.className === next.className &&
  prev.accentColor === next.accentColor &&
  prev.intervalMs === next.intervalMs;

const InnerSlider = memo(function InnerSlider({
  value,
  onChangeRef,
  disabled,
  min,
  max,
  className,
  accentColor,
  intervalMs,
}) {
  const inputRef = useRef(null);
  const draggingRef = useRef(false);
  const timerRef = useRef(null);
  const queuedRef = useRef(null);
  const lastFireRef = useRef(0);

  useEffect(() => {
    if (inputRef.current && !draggingRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const fire = useCallback((v) => {
    const now = Date.now();
    const elapsed = now - lastFireRef.current;
    queuedRef.current = v;
    if (elapsed >= intervalMs) {
      lastFireRef.current = now;
      onChangeRef.current?.(v);
      queuedRef.current = null;
      return;
    }
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (queuedRef.current != null) {
        const pending = queuedRef.current;
        queuedRef.current = null;
        lastFireRef.current = Date.now();
        onChangeRef.current?.(pending);
      }
    }, intervalMs - elapsed);
  }, [intervalMs]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (queuedRef.current != null) {
      const pending = queuedRef.current;
      queuedRef.current = null;
      lastFireRef.current = Date.now();
      onChangeRef.current?.(pending);
    }
  }, []);

  const startDrag = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    flush();
  }, [flush]);

  return (
    <input
      ref={inputRef}
      type="range"
      min={min}
      max={max}
      defaultValue={value}
      disabled={disabled}
      onChange={(e) => fire(Number(e.target.value))}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
      onPointerDown={startDrag}
      onMouseUp={endDrag}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyUp={endDrag}
      onBlur={endDrag}
      className={className}
      style={{ accentColor }}
    />
  );
}, compareInner);

export default function SmoothLevelSlider({
  value,
  onChange,
  disabled = false,
  min = 0,
  max = 100,
  className = "",
  accentColor = "#f59e0b",
  intervalMs = 120,
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  return (
    <InnerSlider
      disabled={disabled}
      min={min}
      max={max}
      className={className}
      accentColor={accentColor}
      intervalMs={intervalMs}
      value={value}
      onChangeRef={onChangeRef}
    />
  );
}
