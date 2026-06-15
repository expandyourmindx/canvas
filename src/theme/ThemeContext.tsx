/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, ReactNode } from "react";
import {
  DARK,
  LIGHT,
  raised as vcRaised,
  sunken as vcSunken,
  flat as vcFlat,
  flush as vcFlush,
  SPACE,
  SIZE
} from "../../public/Themes/Vintage Console/tokens";
import {
  ATARI_PAPER,
  raised as atariRaised,
  sunken as atariSunken,
  flat as atariFlat,
  flush as atariFlush
} from "../../public/Themes/Atari Paper/atari-paper-tokens";

export const THEMES = {
  "vintage-dark":  DARK,
  "vintage-light": LIGHT,
  "atari-paper":   ATARI_PAPER,
} as const;

export { DARK, vcRaised as raised, vcSunken as sunken, vcFlat as flat, vcFlush as flush, SPACE, SIZE };

export type ThemeName = keyof typeof THEMES;

interface ThemeContextValue {
  theme: typeof DARK;
  raised: typeof vcRaised;
  sunken: typeof vcSunken;
  flat: typeof vcFlat;
  flush: typeof vcFlush;
  SPACE: typeof DARK.SPACE;
  SIZE: typeof DARK.SIZE;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>("vintage-dark");

  const activeTheme = THEMES[themeName];

  // Resolve active bevel functions
  const activeRaised = themeName === "atari-paper" ? atariRaised : vcRaised;
  const activeSunken = themeName === "atari-paper" ? atariSunken : vcSunken;
  const activeFlat = themeName === "atari-paper" ? atariFlat : vcFlat;
  const activeFlush = themeName === "atari-paper" ? atariFlush : vcFlush;

  const value: ThemeContextValue = {
    theme: activeTheme as any,
    raised: activeRaised as any,
    sunken: activeSunken as any,
    flat: activeFlat as any,
    flush: activeFlush as any,
    SPACE: activeTheme.SPACE,
    SIZE: activeTheme.SIZE,
    themeName,
    setThemeName,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
