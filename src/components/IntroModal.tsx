/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useTheme } from "../theme/ThemeContext";

export function IntroModal() {
  const { theme, raised, sunken, SPACE } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // On app load, check localStorage key `canvas-intro-dismissed`
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("canvas-intro-dismissed");
      if (dismissed !== "true") {
        setIsOpen(true);
      }
    } catch (e) {
      // Fallback for private browsing mode where localStorage can throw
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem("canvas-intro-dismissed", "true");
      } catch (e) {
        console.error("Failed to write to localStorage", e);
      }
    }
    setIsOpen(false);
  };

  // Close on Escape key press (dismisses for current session only, unless checkbox is armed)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, dontShowAgain]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        zIndex: 9999, // Render on top of everything (highest z-index)
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={handleDismiss} // Click on backdrop dismisses
    >
      <div
        style={{
          width: "400px",
          maxWidth: "90%",
          backgroundColor: theme.bg2,
          padding: `${SPACE.lg}px`,
          boxSizing: "border-box",
          ...raised(theme), // Bevel/depth via border treatment only
          borderRadius: 0,
          boxShadow: "none",
          display: "flex",
          flexDirection: "column",
          gap: `${SPACE.lg}px`,
        }}
        onClick={(e) => e.stopPropagation()} // Prevent dismissal when clicking inside the modal
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: theme.font,
              fontSize: "12px",
              fontWeight: "bold",
              color: theme.textHi,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
            }}
          >
            {/* ELIJAH: replace this title */}
            WELCOME TO CANVAS
          </span>
          <button
            onClick={handleDismiss}
            style={{
              backgroundColor: "transparent",
              color: theme.textMid,
              border: "none",
              fontFamily: theme.font,
              fontSize: "10px",
              fontWeight: "bold",
              cursor: "pointer",
              padding: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = theme.textHi)}
            onMouseLeave={(e) => (e.currentTarget.style.color = theme.textMid)}
          >
            [X]
          </button>
        </div>

        {/* Body Paragraphs */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: `${SPACE.md}px`,
          }}
        >
          <p
            style={{
              fontFamily: theme.font,
              fontSize: "9px",
              color: theme.textMid,
              lineHeight: "1.4",
              margin: 0,
            }}
          >
            {/* ELIJAH: replace this body */}
            Canvas is a multi-track web-based digital audio workstation (DAW) designed to run completely inside your browser. Build patterns, arrange clips on the canvas, route signals through the mixer, and export your track.
          </p>
          <p
            style={{
              fontFamily: theme.font,
              fontSize: "9px",
              color: theme.textMid,
              lineHeight: "1.4",
              margin: 0,
            }}
          >
            {/* ELIJAH: replace this body */}
            Use the sample browser on the left to drag and drop audio files, or create notes in the Piano Roll to play virtual instruments. Enjoy high-performance, low-latency audio processing in real-time.
          </p>
        </div>

        {/* Footer with Checkbox & Dismiss Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: `${SPACE.sm}px`,
          }}
        >
          {/* Custom Checkbox */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none",
            }}
            onClick={() => setDontShowAgain(!dontShowAgain)}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                backgroundColor: theme.bg0,
                marginRight: `${SPACE.sm}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                ...sunken(theme),
              }}
            >
              {dontShowAgain && (
                <span
                  style={{
                    fontFamily: theme.font,
                    fontSize: "8px",
                    fontWeight: "bold",
                    color: theme.accentMaster || theme.textHi,
                  }}
                >
                  X
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: theme.font,
                fontSize: "9px",
                color: theme.textMid,
              }}
            >
              Don't show this again
            </span>
          </div>

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            style={{
              backgroundColor: theme.bg3,
              color: theme.textHi,
              border: "none",
              fontFamily: theme.font,
              fontSize: "9px",
              fontWeight: "bold",
              cursor: "pointer",
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              boxSizing: "border-box",
              borderRadius: 0,
              ...raised(theme),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.bg4;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.bg3;
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
