import { useEffect, useRef, useState } from "react";

/**
 * Counts distraction events while `active` is true.
 * A distraction = tab hidden OR window blurred for > thresholdMs.
 */
export function useDistractionTracker(active: boolean, thresholdMs = 1500) {
  const [count, setCount] = useState(0);
  const hiddenAt = useRef<number | null>(null);

  // Reset when activation transitions to true (new session)
  useEffect(() => {
    if (active) setCount(0);
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const onHide = () => { hiddenAt.current = Date.now(); };
    const onShow = () => {
      if (hiddenAt.current && Date.now() - hiddenAt.current >= thresholdMs) {
        setCount((c) => c + 1);
      }
      hiddenAt.current = null;
    };

    const onVisibility = () => {
      if (document.hidden) onHide();
      else onShow();
    };

    window.addEventListener("blur", onHide);
    window.addEventListener("focus", onShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onHide);
      window.removeEventListener("focus", onShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, thresholdMs]);

  return { distractions: count, reset: () => setCount(0) };
}