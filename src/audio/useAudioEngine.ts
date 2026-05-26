/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useContext } from "react";
import { AudioEngineContext, AudioEngineContextType } from "./AudioEngineProvider";

/**
 * useAudioEngine Custom Hook
 * 
 * Provides safe, declarative, high-performance visual-synced access to our
 * DAW Audio Engine singleton and its related metadata parameters.
 * 
 * Can be imported by any visual timeline, transport bar, or sequencer canvas
 * components placed as descendents of the `<AudioEngineProvider>`.
 */
export function useAudioEngine(): AudioEngineContextType {
  const context = useContext(AudioEngineContext);
  if (!context) {
    throw new Error(
      "useAudioEngine must be used within a valid <AudioEngineProvider>. " +
      "Ensure that the AudioEngineProvider wraps your React application component tree."
    );
  }
  return context;
}
