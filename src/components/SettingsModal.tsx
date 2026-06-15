/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useTheme, ThemeName } from "../theme/ThemeContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE, themeName, setThemeName } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "260px",
          backgroundColor: DARK.bg2,
          padding: `${SPACE.lg}px`,
          boxSizing: "border-box",
          ...flat(DARK),
          borderRadius: 0,
          boxShadow: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: `${SPACE.lg}px`,
          }}
        >
          <span
            style={{
              fontFamily: DARK.font,
              fontSize: "10px",
              fontWeight: "bold",
              color: DARK.textHi,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
            }}
          >
            SETTINGS
          </span>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "transparent",
              color: DARK.textMid,
              border: "none",
              fontFamily: DARK.font,
              fontSize: "10px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = DARK.textHi)}
            onMouseLeave={(e) => (e.currentTarget.style.color = DARK.textMid)}
          >
            [X]
          </button>
        </div>

        {/* Content Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: `${SPACE.sm}px` }}>
          <label
            style={{
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              color: DARK.textLo,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Theme
          </label>
          <select
            value={themeName}
            onChange={(e) => setThemeName(e.target.value as ThemeName)}
            style={{
              backgroundColor: DARK.bg0,
              color: DARK.lcdText,
              border: `1px solid ${DARK.bevelMid}`,
              fontFamily: DARK.font,
              fontSize: "9px",
              padding: `${SPACE.sm}px`,
              outline: "none",
              cursor: "pointer",
              boxSizing: "border-box",
              width: "100%",
              borderRadius: 0,
            }}
          >
            <option value="vintage-dark" style={{ backgroundColor: DARK.bg0, color: DARK.lcdText }}>Vintage Console — Dark</option>
            <option value="vintage-light" style={{ backgroundColor: DARK.bg0, color: DARK.lcdText }}>Vintage Console — Light</option>
            <option value="atari-paper" style={{ backgroundColor: DARK.bg0, color: DARK.lcdText }}>Atari Paper</option>
          </select>
        </div>
      </div>
    </div>
  );
}
