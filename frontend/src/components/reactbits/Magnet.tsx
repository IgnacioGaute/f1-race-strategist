"use client";

// Adapted from React Bits "Magnet" (https://reactbits.dev).
// Copyright (c) 2026 David Haz — MIT + Commons Clause License Condition v1.0.
// Ported to TypeScript and trimmed to a single magnet: the content leans
// towards a nearby pointer with a spring, and rests when disabled or when the
// user prefers reduced motion.

import { type ReactNode, useEffect, useRef } from "react";

interface MagnetProps {
  children: ReactNode;
  /** Distance around the element, in px, where the pull starts. */
  padding?: number;
  /** Higher values pull less (offset = distance / strength). */
  magnetStrength?: number;
  /** Largest offset, in px. */
  maxOffset?: number;
  disabled?: boolean;
  className?: string;
}

const SPRING = { stiffness: 170, damping: 16 };

export function Magnet({
  children,
  padding = 60,
  magnetStrength = 6,
  maxOffset = 10,
  disabled = false,
  className,
}: MagnetProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner || typeof requestAnimationFrame !== "function") return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce) return undefined;

    const current = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      let resting = true;
      for (const axis of ["x", "y"] as const) {
        const force = SPRING.stiffness * (target[axis] - current[axis]) - SPRING.damping * velocity[axis];
        velocity[axis] += force * dt;
        current[axis] += velocity[axis] * dt;
        if (Math.abs(target[axis] - current[axis]) > 0.05 || Math.abs(velocity[axis]) > 0.05) resting = false;
      }
      if (resting) {
        current.x = target.x;
        current.y = target.y;
        velocity.x = 0;
        velocity.y = 0;
        last = 0;
      }
      inner.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)`;
      if (!resting) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = wrapper.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const outside = Math.hypot(
        Math.max(0, Math.abs(dx) - rect.width / 2),
        Math.max(0, Math.abs(dy) - rect.height / 2),
      );
      if (disabledRef.current || outside > padding) {
        target.x = 0;
        target.y = 0;
      } else {
        let x = dx / magnetStrength;
        let y = dy / magnetStrength;
        const length = Math.hypot(x, y);
        if (length > maxOffset) {
          x *= maxOffset / length;
          y *= maxOffset / length;
        }
        target.x = x;
        target.y = y;
      }
      wake();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [padding, magnetStrength, maxOffset]);

  return (
    <div ref={wrapperRef} className={className ? `magnet ${className}` : "magnet"}>
      <div ref={innerRef} className="magnet__inner">
        {children}
      </div>
    </div>
  );
}
