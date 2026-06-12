/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";

// 1. Precise QWERTY to Piano Semitone mapping Dictionary (2 full octaves)
const KEY_TO_SEMITONE: Record<string, number> = {
  // Lower Octave
  "z": 0,
  "s": 1,
  "x": 2,
  "d": 3,
  "c": 4,
  "v": 5,
  "g": 6,
  "b": 7,
  "h": 8,
  "n": 9,
  "j": 10,
  "m": 11,
  ",": 12,

  // Upper Octave
  "q": 12,
  "2": 13,
  "w": 14,
  "3": 15,
  "e": 16,
  "r": 17,
  "5": 18,
  "t": 19,
  "6": 20,
  "y": 21,
  "7": 22,
  "u": 23,
  "i": 24
};

// Also support capital keys in case CapLock is toggled
const KEY_MAP_LOWERCASE: Record<string, number> = {};
Object.entries(KEY_TO_SEMITONE).forEach(([key, semitone]) => {
  KEY_MAP_LOWERCASE[key.toLowerCase()] = semitone;
});

interface ActiveNoteState {
  key: string;
  channelId: string;
  midiNote: number;
}

export function KeyboardMidiListener() {
  const {
    pcKeyboardMidiActive,
    baseOctave,
    focusedChannelId,
    triggerNoteOn,
    triggerNoteOff,
  } = useAudioEngine();

  // Keep a reference of held keys to prevent hanging notes if octave / target channels change in flight
  const activeNotesRef = useRef<Map<string, ActiveNoteState>>(new Map());

  // Define unified routing operations
  const handleNoteOn = (channelId: string, midiNote: number, velocity: number = 100) => {
    if (!channelId) return;
    console.log(`[MIDI System Routing On] Channel: ${channelId} | Note: ${midiNote} | Velocity: ${velocity}`);
    triggerNoteOn(channelId, midiNote, velocity);
  };

  const handleNoteOff = (channelId: string, midiNote: number) => {
    if (!channelId) return;
    console.log(`[MIDI System Routing Off] Channel: ${channelId} | Note: ${midiNote}`);
    triggerNoteOff(channelId, midiNote);
  };

  // PC Keyboard QWERTY MIDI Hook
  useEffect(() => {
    if (!pcKeyboardMidiActive) {
      // Clear any remaining held down keys on inactive toggle to prevent sound leaks
      activeNotesRef.current.forEach(({ channelId, midiNote }) => {
        handleNoteOff(channelId, midiNote);
      });
      activeNotesRef.current.clear();
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.ctrlKey || event.metaKey) return;

      // Strict Logic: Avoid capturing when interactive text layers are active
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const keyLower = event.key.toLowerCase();
      const semitone = KEY_MAP_LOWERCASE[keyLower];
      if (semitone === undefined) return;

      if (!focusedChannelId) return;

      // Prevent duplicating note on events
      if (activeNotesRef.current.has(keyLower)) return;

      // MIDI Note calculation offset: Middle C (C4) starts at standard octave index value
      const midiNote = (baseOctave + 1) * 12 + semitone;

      // Store in tracking registry reference
      activeNotesRef.current.set(keyLower, {
        key: keyLower,
        channelId: focusedChannelId,
        midiNote
      });

      handleNoteOn(focusedChannelId, midiNote, 100);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const keyLower = event.key.toLowerCase();
      const heldState = activeNotesRef.current.get(keyLower);
      if (!heldState) return;

      // Ensure release routes to the EXACT matched channel and pitch it generated initially
      handleNoteOff(heldState.channelId, heldState.midiNote);
      activeNotesRef.current.delete(keyLower);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pcKeyboardMidiActive, baseOctave, focusedChannelId, triggerNoteOn, triggerNoteOff]);

  // Web MIDI API (USB External Hardware Keyboard Controllers)
  useEffect(() => {
    const nav = navigator as any;
    if (!nav || typeof nav.requestMIDIAccess !== "function") {
      console.log("[MIDI Setup] Web MIDI API is not natively supported in this environment browser.");
      return;
    }

    let midiAccess: any = null;

    const onMidiMessage = (event: any) => {
      if (!focusedChannelId) return;
      
      const [status, note, velocity] = event.data;
      const command = status & 0xf0;

      // Route based on command byte
      if (command === 0x90) { // Note On
        if (velocity > 0) {
          handleNoteOn(focusedChannelId, note, velocity);
        } else {
          handleNoteOff(focusedChannelId, note);
        }
      } else if (command === 0x80) { // Note Off
        handleNoteOff(focusedChannelId, note);
      }
    };

    const setupMidiInputs = (access: any) => {
      access.inputs.forEach((input: any) => {
        input.onmidimessage = onMidiMessage;
      });
    };

    nav.requestMIDIAccess()
      .then((access: any) => {
        midiAccess = access;
        setupMidiInputs(access);
        
        access.onstatechange = () => {
          setupMidiInputs(access);
        };
        console.log("[MIDI Setup] Web MIDI Driver initialized successfully - listening on incoming devices.");
      })
      .catch((err: any) => {
        console.warn("[MIDI Setup] USB MIDI Access request denied:", err);
      });

    return () => {
      if (midiAccess) {
        midiAccess.inputs.forEach((input: any) => {
          input.onmidimessage = null;
        });
        midiAccess.onstatechange = null;
      }
    };
  }, [focusedChannelId, triggerNoteOn, triggerNoteOff]);

  return null;
}
