import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Range slider that drives a network-backed level command (Lutron
 * GoToDimmedLevel etc.) without locking up while a command is in flight.
 *
 * Naive `<input type=range disabled={busy} onChange=fire>` patterns
 * break dragging in three ways which all show up at once:
 *
 *   1. `disabled` flipping to true the instant the first onChange fires
 *      cancels the active drag gesture in every browser. The thumb
 *      "sticks" and the user has to click again — exactly the
 *      "click works, dragging doesn't" symptom you'd see in the field.
 *   2. A real drag emits dozens of onChange events per second; firing
 *      a LEAP command on every one floods the processor and queues up
 *      hundreds of round-trips. The slider feels laggy and the lights
 *      visibly chase the cursor in a stair-step pattern.
 *   3. SSE-driven status updates from the processor (wall keypads,
 *      scenes, other clients) clobber the slider value mid-drag if
 *      we drive the input from external props.
 *
 * This component fixes all three:
 *
 *   - The input is never disabled mid-drag. `busy` only dims the
 *     thumb; pass `disabled` for the "no connection" case.
 *   - Commands are leading+trailing throttled to ~8/sec, with a final
 *     "commit" sent on pointer release so the end position always
 *     lands on the processor.
 *   - Internal `local` state mirrors `value`, but only resyncs from
 *     the prop while the user is NOT dragging.
 */
export default function SmoothLevelSlider({
  value,
  onChange,
  disabled = false,
  busy = false,
  min = 0,
  max = 100,
  className = "",
  accentColor = "#f59e0b",
  intervalMs = 120,
}) {
  const [local, setLocal] = useState(value);
  // We deliberately do NOT bind the slider's `disabled` attribute to a
  // mid-flight busy state. Instead, we mirror `busy` into React state
  // and only surface it visually after a 350ms debounce — long enough
  // that the throttled per-tick command roundtrips (which toggle
  // pending true → false every ~120ms) never paint at all. This is
  // the cause of the "slider flashes while dragging" symptom: each
  // tick was switching opacity 1 → 0.7 → 1.
  const [debouncedBusy, setDebouncedBusy] = useState(false);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const timerRef = useRef(null);
  const queuedRef = useRef(null);
  const lastFireRef = useRef(0);
  const busyTimerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!draggingRef.current) setLocal(value);
  }, [value]);

  // Debounced visualisation of `busy`. Setting true is delayed so a
  // brief roundtrip is invisible; clearing busy is immediate.
  useEffect(() => {
    if (busyTimerRef.current) {
      clearTimeout(busyTimerRef.current);
      busyTimerRef.current = null;
    }
    if (busy && !isDragging) {
      busyTimerRef.current = setTimeout(() => {
        busyTimerRef.current = null;
        setDebouncedBusy(true);
      }, 350);
    } else {
      setDebouncedBusy(false);
    }
    return () => {
      if (busyTimerRef.current) {
        clearTimeout(busyTimerRef.current);
        busyTimerRef.current = null;
      }
    };
  }, [busy, isDragging]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    []
  );

  const fire = useCallback(
    (v) => {
      const now = Date.now();
      const elapsed = now - lastFireRef.current;
      queuedRef.current = v;
      if (elapsed >= intervalMs) {
        lastFireRef.current = now;
        onChangeRef.current?.(v);
        queuedRef.current = null;
        return;
      }
      if (timerRef.current) return; // trailing flush already armed
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (queuedRef.current != null) {
          const pending = queuedRef.current;
          queuedRef.current = null;
          lastFireRef.current = Date.now();
          onChangeRef.current?.(pending);
        }
      }, intervalMs - elapsed);
    },
    [intervalMs]
  );

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
    setIsDragging(true);
  }, []);
  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    flush();
  }, [flush]);

  // Final visual rule:
  //   - During an active drag, opacity is locked to 1 so the thumb
  //     never flickers between throttled ticks.
  //   - When idle, a *sustained* in-flight command (debouncedBusy)
  //     fades the track slightly so the operator knows the processor
  //     is still applying the last change.
  const visualOpacity = isDragging
    ? 1
    : debouncedBusy && !disabled
    ? 0.78
    : 1;

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={local}
      disabled={disabled}
      onChange={(e) => {
        const v = Number(e.target.value);
        setLocal(v);
        fire(v);
      }}
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
      style={{
        accentColor,
        opacity: visualOpacity,
        transition: "opacity 220ms ease",
      }}
    />
  );
}
