import { useEffect, useRef, useCallback } from "react";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const WARN_BEFORE_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown", "touchstart", "scroll", "click",
];

interface UseIdleTimeoutOptions {
  onIdle: () => void;
  onWarn: () => void;
  onActivity: () => void;
}

export function useIdleTimeout({ onIdle, onWarn, onActivity }: UseIdleTimeoutOptions) {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    warnTimer.current = setTimeout(onWarn, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
    idleTimer.current = setTimeout(onIdle, IDLE_TIMEOUT_MS);
  }, [clearTimers, onIdle, onWarn]);

  const handleActivity = useCallback(() => {
    onActivity();
    resetTimers();
  }, [onActivity, resetTimers]);

  useEffect(() => {
    resetTimers();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [resetTimers, handleActivity, clearTimers]);
}
