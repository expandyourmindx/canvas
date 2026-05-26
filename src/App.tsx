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

function MainWorkspace() {
  return (
    <>
      <KeyboardMidiListener />
      <Desktop />
    </>
  );
}

export default function App() {
  return (
    <AudioEngineProvider>
      <MainWorkspace />
    </AudioEngineProvider>
  );
}
