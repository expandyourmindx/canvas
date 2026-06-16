/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { AudioEngineProvider } from "./audio/AudioEngineProvider";
import { useAudioEngine } from "./audio/useAudioEngine";
import { generateDrumSampleWav } from "./audio/sampleGenerator";
import { Desktop } from "./components/Desktop";
import { KeyboardMidiListener } from "./components/KeyboardMidiListener";
import { IntroModal } from "./components/IntroModal";
import { ShortcutRegistryProvider } from "./hooks/useShortcutRegistry";
import { ThemeProvider } from "./theme/ThemeContext";

function MainWorkspace() {
  return (
    <>
      <KeyboardMidiListener />
      <Desktop />
      <IntroModal />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ShortcutRegistryProvider>
        <AudioEngineProvider>
          <MainWorkspace />
        </AudioEngineProvider>
      </ShortcutRegistryProvider>
    </ThemeProvider>
  );
}
