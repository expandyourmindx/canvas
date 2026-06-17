import React from "react";
import { ChannelRow, CanvasClip } from "../../../types";
import { AVAILABLE_SAMPLES } from "../../../config";
import { getLibraryManager } from "../../SampleBrowser";

export function getSampleName(id: string) {
  const preset = AVAILABLE_SAMPLES.find(s => s.id === id);
  if (preset) return preset.name;

  // Extract filename from full path
  const parts = id.split(/[/\\]/);
  const fileName = parts[parts.length - 1] || id;

  return fileName
    .replace(/\.(wav|mp3|ogg|flac|aac|m4a)$/i, "")
    .split(/[-_]/)
    .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : "")
    .join(" ");
}

interface UseArrangerDropProps {
  engine: any;
  channels: ChannelRow[];
  setChannels?: React.Dispatch<React.SetStateAction<ChannelRow[]>>;
  setChannelVols?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setChannelMixers?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setActiveInstrumentId?: (id: string) => void;
  setFocusedChannelId?: (id: string) => void;
  onOpenSampler?: (channelId: string) => void;
  onOpenWindow?: (windowId: "pianoroll" | "sequencer" | "sampler" | "wam" | "canvas") => void;
  onOpenPianoRoll?: (channelId: string) => void;
  totalBeats: number;
  activeSnapResolution: number | null;
  setCanvasClips: React.Dispatch<React.SetStateAction<CanvasClip[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedClipType: (type: "pattern" | "sample" | null) => void;
  setSelectedReferenceId: (id: string) => void;
  setClipDurationBeats: (duration: number) => void;
  setClipCropStart: (crop: number) => void;
  pushToHistory?: (channels?: ChannelRow[]) => void;
  notifySampleLoaded?: () => void;
  getSampleBuffer: (id: string) => any;
  DARK: any;
}

export function useArrangerDrop({
  engine,
  channels,
  setChannels,
  setChannelVols,
  setChannelMixers,
  setActiveInstrumentId,
  setFocusedChannelId,
  onOpenSampler,
  onOpenWindow,
  totalBeats,
  activeSnapResolution,
  setCanvasClips,
  setSelectedIds,
  setSelectedClipType,
  setSelectedReferenceId,
  setClipDurationBeats,
  setClipCropStart,
  pushToHistory,
  notifySampleLoaded,
  getSampleBuffer,
  DARK
}: UseArrangerDropProps) {
  const handleAudioFileImport = async (file: File) => {
    if (!engine || !setChannels) return;
    if (!file.type.startsWith("audio/") && !file.name.endsWith(".wav") && !file.name.endsWith(".mp3")) {
      console.warn("Invalid audio file format");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
      const sanitizedId = `sample_${cleanFileName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;

      // 1. Load buffer into AudioEngine registry
      await engine.loadSample(sanitizedId, arrayBuffer);

      // 2. Append new channel row state
      const nextIndex = channels.length + 1;
      const newChanId = `sampler_${Date.now()}`;
      const newChannel = {
        id: newChanId,
        name: cleanFileName.slice(0, 20),
        type: "sample" as const,
        sampleId: sanitizedId,
        mixerTarget: Math.min(99, nextIndex),
        instrumentType: "sampler" as const
      };

      setChannels(prev => [...prev, newChannel]);
      if (setActiveInstrumentId) {
        setActiveInstrumentId(newChanId);
      }
      if (setFocusedChannelId) {
        setFocusedChannelId(newChanId);
      }

      // 3. Initialize volumes and mixers in React state
      if (setChannelVols) setChannelVols(prev => ({ ...prev, [newChanId]: 80 }));
      if (setChannelMixers) setChannelMixers(prev => ({ ...prev, [newChanId]: Math.min(99, nextIndex) }));

      // 4. Mirror in engine
      engine.focusedChannelId = newChanId;
      engine.updateChannelVolume(newChanId, 80);
      engine.updateChannelPan(newChanId, 0);
      engine.updateChannelMixerTarget(newChanId, Math.min(99, nextIndex));
      engine.updateChannelSampleId(newChanId, sanitizedId);
      if (engine.updateChannelInstrumentType) {
        engine.updateChannelInstrumentType(newChanId, "sampler");
      }

      // 5. Open Sampler view immediately
      if (onOpenSampler) {
        onOpenSampler(newChanId);
      }

      console.log(`Audio sample "${file.name}" imported and loaded successfully.`);
    } catch (err) {
      console.error("Failed to decode and load audio sample", err);
    }
  };

  const handleDropOnLane = async (e: React.DragEvent<HTMLDivElement>, laneIdx: number) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;

    try {
      const droppedObj = JSON.parse(dataStr);
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const rawBeat = (offsetX / rect.width) * totalBeats;
      const snap = activeSnapResolution;
      const snappedBeat = snap !== null ? Math.round(rawBeat / snap) * snap : rawBeat;

      if (droppedObj.type === "pattern") {
        const patternId = droppedObj.id;
        const patternName = droppedObj.name;
        const durationBeats = 4; // Patterns default to 4 beats

        const newClip = {
          id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          laneIndex: laneIdx,
          startBeat: Math.max(0, Math.min(totalBeats - durationBeats, snappedBeat)),
          duration: durationBeats,
          type: "pattern" as const,
          referenceId: patternId,
          name: patternName,
          color: DARK.accentBlue,
          cropStart: 0,
        };

        setCanvasClips(prev => [...prev, newClip]);
        setSelectedIds([newClip.id]);

        // Load properties into pencil tool for the next placement
        setSelectedClipType("pattern");
        setSelectedReferenceId(patternId);
        setClipDurationBeats(4);
        setClipCropStart(0);

        if (pushToHistory) {
          pushToHistory();
        }
        return;
      }

      // Sample drop logic
      const id = droppedObj.id;
      const path = droppedObj.path;
      let durationBeats = 4;
      let buffer = getSampleBuffer(id);

      // Ensure the buffer is fully loaded and decoded in the engine
      if (!buffer && engine) {
        try {
          if (path) {
            // Built-in sample: fetch and load
            const res = await fetch(path);
            if (res.ok) {
              const ab = await res.arrayBuffer();
              buffer = await engine.loadSample(id, ab);
              if (notifySampleLoaded) {
                notifySampleLoaded();
              }
            }
          } else {
            // User sample: load from library
            const libraryManager = getLibraryManager();
            const node = libraryManager.findNodeByPath(id);
            if (node) {
              const arrayBuffer = await libraryManager.loadBuffer(node);
              buffer = await engine.loadSample(id, arrayBuffer);
              if (notifySampleLoaded) {
                notifySampleLoaded();
              }
            }
          }
        } catch (loadErr) {
          console.error("Failed to load sample buffer on timeline drop:", loadErr);
        }
      }

      if (buffer) {
        durationBeats = engine.secondsToBeats(buffer.duration);
      }

      // Find or create a matching channel rack entry for the dropped sample
      let targetChannelId = id;
      const existingChannel = channels.find(c => c.sampleId === id || c.id === id);

      let updatedChannels: ChannelRow[] | undefined;
      if (existingChannel) {
        targetChannelId = existingChannel.id;
      } else if (setChannels) {
        const nextIndex = channels.length + 1;
        const newChanId = `sampler_${Date.now()}`;
        const newChannel = {
          id: newChanId,
          name: getSampleName(id).slice(0, 20),
          type: "sample" as const,
          sampleId: id,
          mixerTarget: Math.min(99, nextIndex),
          instrumentType: "sampler" as const
        };

        updatedChannels = [...channels, newChannel];
        setChannels(updatedChannels);
        if (setActiveInstrumentId) {
          setActiveInstrumentId(newChanId);
        }
        if (setFocusedChannelId) {
          setFocusedChannelId(newChanId);
        }

        if (setChannelVols) setChannelVols(prev => ({ ...prev, [newChanId]: 80 }));
        if (setChannelMixers) setChannelMixers(prev => ({ ...prev, [newChanId]: Math.min(99, nextIndex) }));

        engine.updateChannelVolume(newChanId, 80);
        engine.updateChannelPan(newChanId, 0);
        engine.updateChannelMixerTarget(newChanId, Math.min(99, nextIndex));
        engine.updateChannelSampleId(newChanId, id);
        if (engine.updateChannelInstrumentType) {
          engine.updateChannelInstrumentType(newChanId, "sampler");
        }

        targetChannelId = newChanId;
      }

      const newClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        laneIndex: laneIdx,
        startBeat: Math.max(0, Math.min(totalBeats - durationBeats, snappedBeat)),
        duration: durationBeats,
        type: "sample" as const,
        referenceId: targetChannelId,
        name: getSampleName(id),
        color: DARK.accentGreen,
        cropStart: 0,
      };

      setCanvasClips(prev => {
        const updated = [...prev, newClip];
        return updated;
      });

      // Select the newly dropped clip exclusively
      setSelectedIds([newClip.id]);

      // Load properties into pencil tool for the next placement
      setSelectedClipType(newClip.type);
      setSelectedReferenceId(newClip.referenceId);
      setClipDurationBeats(newClip.duration);
      setClipCropStart(newClip.cropStart || 0);

      if (pushToHistory) {
        pushToHistory(updatedChannels);
      }
    } catch (err) {
      console.error("Error setting canvas clip from sample drop", err);
    }
  };

  return {
    handleAudioFileImport,
    handleDropOnLane
  };
}
