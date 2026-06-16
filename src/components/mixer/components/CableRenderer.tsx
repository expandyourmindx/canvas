import React, { useState, useEffect, useRef } from "react";
import { MixerInsert } from "../../../audio/MixerManager";

interface CableRendererProps {
  inserts: MixerInsert[];
  isVisible: boolean;
  anchorRefs: React.RefObject<(HTMLDivElement | null)[]>;
  windowPosRef: React.RefObject<{ x: number; y: number }>;
  prevWindowPosRef: React.RefObject<{ x: number; y: number }>;
}

export function CableRenderer({
  inserts,
  isVisible,
  anchorRefs,
  windowPosRef,
  prevWindowPosRef,
}: CableRendererProps) {
  const [cables, setCables] = useState<{ key: string; dOuter: string; dInner: string }[]>([]);
  const cablesPhysicsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const hasSends = inserts.some(ins => ins.sends && ins.sends.length > 0);
    const active = isVisible && hasSends;

    if (!active) {
      setCables([]);
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      return;
    }

    const animate = () => {
      const dx = windowPosRef.current.x - prevWindowPosRef.current.x;
      const dy = windowPosRef.current.y - prevWindowPosRef.current.y;
      prevWindowPosRef.current = { ...windowPosRef.current };

      const newCables: { key: string; dOuter: string; dInner: string }[] = [];
      const currentKeys = new Set<string>();

      const sagAmount = 180;
      const springStrength = 0.06;
      const damping = 0.88;

      inserts.forEach((sourceInsert) => {
        if (!sourceInsert.sends) return;

        sourceInsert.sends.forEach((send) => {
          const fromIdx = sourceInsert.index;
          const toIdx = send.targetInsertIndex;
          const key = `${fromIdx}-${toIdx}`;
          currentKeys.add(key);

          const fromEl = anchorRefs.current ? anchorRefs.current[fromIdx] : null;
          const toEl = anchorRefs.current ? anchorRefs.current[toIdx] : null;

          if (!fromEl || !toEl) return;

          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();

          const x1 = fromRect.left + fromRect.width / 2;
          const y1 = fromRect.top + fromRect.height / 2;
          const x2 = toRect.left + toRect.width / 2;
          const y2 = toRect.top + toRect.height / 2;

          const midpointX = (x1 + x2) / 2;
          const targetX = midpointX;
          const targetY = ((y1 + y2) / 2) + sagAmount;

          if (!cablesPhysicsRef.current.has(key)) {
            cablesPhysicsRef.current.set(key, {
              x: targetX,
              y: targetY,
              vx: 0,
              vy: 0,
            });
          }

          const phys = cablesPhysicsRef.current.get(key)!;

          // Apply spring physics
          const ax = (targetX - phys.x) * springStrength;
          const ay = (targetY - phys.y) * springStrength;

          phys.vx += ax;
          phys.vy += ay;

          // Window movement force ( lag )
          phys.vx -= dx * 0.16;
          phys.vy -= dy * 0.16;

          phys.vx *= damping;
          phys.vy *= damping;

          phys.x += phys.vx;
          phys.y += phys.vy;

          // Clamp position to max drift of 60px from resting position (targetX, targetY)
          const diffX = phys.x - targetX;
          const diffY = phys.y - targetY;
          const dist = Math.sqrt(diffX * diffX + diffY * diffY);
          if (dist > 60) {
            phys.x = targetX + (diffX / dist) * 60;
            phys.y = targetY + (diffY / dist) * 60;
          }

          // Bezier control points
          const cx1 = x1 + (phys.x - targetX);
          const cy1 = phys.y;
          const cx2 = x2 + (phys.x - targetX);
          const cy2 = phys.y;

          const dOuter = `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
          const dInner = `M ${x1},${y1 - 1} C ${cx1},${cy1 - 1} ${cx2},${cy2 - 1} ${x2},${y2 - 1}`;

          newCables.push({ key, dOuter, dInner });
        });
      });

      // Cleanup
      for (const key of cablesPhysicsRef.current.keys()) {
        if (!currentKeys.has(key)) {
          cablesPhysicsRef.current.delete(key);
        }
      }

      setCables(newCables);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [inserts, isVisible, anchorRefs, windowPosRef, prevWindowPosRef]);

  if (cables.length === 0) return null;

  return (
    <svg
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {cables.map(({ key, dOuter, dInner }) => (
        <React.Fragment key={key}>
          <path
            d={dOuter}
            fill="none"
            stroke="#0a0f16"
            strokeWidth={4}
            opacity={0.9}
          />
          <path
            d={dInner}
            fill="none"
            stroke="#2a3848"
            strokeWidth={2}
            opacity={0.8}
          />
        </React.Fragment>
      ))}
    </svg>
  );
}
