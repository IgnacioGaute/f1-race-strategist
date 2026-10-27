"use client";

// In the spirit of React Bits "CountUp" (https://reactbits.dev), without its
// `motion` dependency: the number eases from its previous value to the new one.
// Screen readers only get the final value; the moving digits are hidden from them.

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  format: (value: number) => string;
  durationMs?: number;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Without matchMedia (tests, very old browsers) the value is shown as is. */
function prefersStatic(): boolean {
  return typeof window === "undefined" || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true);
}

export function CountUp({ value, format, durationMs = 900 }: CountUpProps) {
  // Results only render on the client, after a request: starting at 0 is safe.
  const [shown, setShown] = useState(() => (prefersStatic() ? value : 0));
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (prefersStatic() || typeof requestAnimationFrame !== "function" || start === value) {
      const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => setShown(value)) : 0;
      return () => cancelAnimationFrame(raf);
    }
    let raf = 0;
    const began = performance.now();
    const frame = (now: number) => {
      const progress = Math.min(1, (now - began) / durationMs);
      setShown(start + (value - start) * easeOutCubic(progress));
      if (progress < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="visually-hidden">{format(value)}</span>
    </>
  );
}
