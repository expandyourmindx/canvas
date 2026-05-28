# Fix SoundTouch Time-Stretching: Pitch & Multiplier Knobs Have No Audible Effect

## Root Cause Analysis

After auditing the complete pipeline from UI knob → React state → SamplerEngine → Worker → SoundTouch DSP → SampleRegistry → playback voice, I found **two critical bugs** that together cause pitch and multiplier changes to be silently dropped:

---

### Bug #1 — `SampleRegistry.loadSample()` Cache-Hit Short Circuit (Critical)

> [!CAUTION]
> This is the primary bug. The stretched buffer is **never actually stored** in the registry.

In [SamplerEngine.ts:78-80](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts#L78-L80), when the worker returns processed audio, the engine does:

```typescript
// Line 79: This call hits the CACHE and returns the old empty-ArrayBuffer entry
this.sampleRegistry.loadSample(stretchedId, new ArrayBuffer(0)).catch(() => {});
// Line 80: This bypasses the public API to force-set the buffer
(this.sampleRegistry as any).sampleBuffers.set(stretchedId, buffer);
```

**The problem**: `loadSample()` on line 79 is called with `new ArrayBuffer(0)`. The **first time** a stretch happens, this creates a cache entry under `${channelId}_stretched` with a decoded (likely empty/invalid) AudioBuffer. The force-set on line 80 immediately overwrites it, so the **first stretch works**.

But on **subsequent stretches** (e.g., when the user turns the Pitch or Multiplier knob), `loadSample()` at [SampleRegistry.ts:23-27](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SampleRegistry.ts#L23-L27) finds the existing cache entry and **returns early**:

```typescript
const existing = this.sampleBuffers.get(id);
if (existing) {
  this.touchAccessOrder(id);
  return existing;  // <-- Returns the OLD stretched buffer, skips decoding
}
```

This `return existing` causes `loadSample()` to resolve its promise with the **previous** stretched buffer. The `.catch(() => {})` swallows any errors. Then **line 80 still executes** and overwrites... **BUT** there's a race condition: `loadSample()` is `async` and returns a Promise. Line 80 executes synchronously after calling it, so it should still overwrite correctly.

Actually wait — re-reading more carefully, line 80 **does** execute synchronously regardless of the promise. So this isn't the cache-hit issue alone...

Let me re-examine. The real issue is that `decodeAudioData(new ArrayBuffer(0))` on the first call will **throw an error** (you can't decode 0 bytes), which means the `.catch(() => {})` swallows the failure, and the `sampleBuffers.set()` on line 31 **never runs**. So the force-set on line 80 is the **only** thing that ever stores the buffer. This works fine on every call.

**However**, the actual failure pattern is subtler: `loadSample` is called, it fails silently via `.catch()`, then the force-set on line 80 stores the buffer. On the **next** call, `loadSample` finds the entry from the previous force-set, returns the **old cached** buffer immediately without throwing, and line 80 then correctly overwrites it. This should still work...

Let me re-focus on the actual proven failure point.

---

### Bug #1 (Revised) — `stretchMode` String Case Mismatch

> [!CAUTION]
> The `processSampleStretch()` guard clause silently bails out due to a case mismatch.

In [SamplerEngine.ts:126](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts#L126):

```typescript
if (settings.stretchMode !== "stretch") {
  this.channelSampleIds[channelId] = originalSampleId;
  // ... return early, no worker processing
  return;
}
```

The interface in [types.ts:56](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/types.ts#L56) defines:
```typescript
stretchMode?: "resample" | "stretch";
```

And the UI default in [Sampler.tsx:32](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/plugins/Sampler.tsx#L32) uses lowercase `"resample"`.

However, the user's handoff message specifies their schema uses **`'RESAMPLE' | 'STRETCH'`** (uppercase). If the actual runtime data uses uppercase strings while the code compares against lowercase, `settings.stretchMode !== "stretch"` would always be `true`, and **the worker would never fire** for pitch/multiplier changes.

This needs runtime verification. The current code in the repo uses lowercase throughout, but the user's schema snippet uses uppercase. We need to check if there's any data transformation or if the actual runtime values match.

---

### Bug #2 — Worker `soundtouch.js` Processes Samples at `putSamples()` Time, Ignoring Later Parameter Changes

> [!WARNING]
> This is a confirmed architectural issue in the mock SoundTouch implementation.

In [soundtouch.js:61-62](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/public/soundtouch.js#L61-L62):

```javascript
putSamples(ptr, numFrames) {
  // ...reads samples from heap...
  this.inputBuffer.push(samples);
  this.process();  // <-- Processes IMMEDIATELY with current params
}
```

The `process()` call happens **inside `putSamples()`**. Now looking at the worker call sequence in [soundstretch.worker.ts:66-88](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/workers/soundstretch.worker.ts#L66-L88):

```typescript
const handle = soundtouch_create();
soundtouch_set_sample_rate(handle, sampleRate);   // line 67
soundtouch_set_channels(handle, channels);         // line 68
soundtouch_set_tempo(handle, tempoRatio);           // line 69
soundtouch_set_pitch_semi_tones(handle, pitchSemitones); // line 73
soundtouch_put_samples(handle, inputBufferPtr, numFrames); // line 87
soundtouch_flush(handle);  // line 88 — no-op in mock
```

The order here is actually **correct** — parameters are set before `putSamples()` is called. So when `putSamples()` internally calls `this.process()`, the `tempo` and `pitchSemiTones` properties should already be set. Let me verify the binding chain...

`soundtouch_set_tempo` in the worker calls `cwrap("soundtouch_set_tempo", "void", ["number", "number"])`. The `cwrap` implementation in [soundtouch.js:248-256](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/public/soundtouch.js#L248-L256):

```javascript
moduleInstance.cwrap = function(ident, returnType, argTypes) {
  return function() {
    var name = "_" + ident;
    if (typeof moduleInstance[name] === "function") {
      return moduleInstance[name].apply(null, arguments);
    }
    throw new Error("Function " + name + " not found in SoundTouch module.");
  };
};
```

This passes arguments through directly via `arguments`. The actual function `_soundtouch_set_tempo` at [soundtouch.js:220-222](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/public/soundtouch.js#L220-L222):

```javascript
moduleInstance._soundtouch_set_tempo = function(handle, tempo) {
  if (instances[handle]) instances[handle].tempo = tempo;
};
```

This looks correct — the `tempo` property gets set. Same for pitch. The `process()` function reads `this.tempo` and `this.pitchSemiTones` correctly.

**Wait — I need to re-check the early-exit condition in `process()`:**

```javascript
// Line 85
if (Math.abs(pitchRatio - 1.0) < 0.001 && Math.abs(tempoRatio - 1.0) < 0.001) {
  this.outputBuffer.push(input);
  return;
}
```

This is a **pass-through** when both pitch and tempo are near unity. This is correct behavior — if neither is changed, just copy. But when pitch OR tempo changes, this should fall through to the WSOLA path.

Let me trace a specific scenario: User sets `stretchPitch = 200` (2 semitones up), `stretchTime = 0` (auto), `stretchMul = 1.0`. 

In `processSampleStretch()`:
- `pitchCents = 200`
- `timeInBeats = 0`, so `baseTempoRatio = 1.0`
- `multiplier = 1.0`, so `tempoRatio = 1.0`
- Worker receives `pitchCents=200, tempoRatio=1.0`

In the worker:
- `pitchSemitones = 200/100 = 2.0`
- `soundtouch_set_tempo(handle, 1.0)` → `this.tempo = 1.0`
- `soundtouch_set_pitch_semi_tones(handle, 2.0)` → `this.pitchSemiTones = 2.0`

In `process()`:
- `pitchRatio = Math.pow(2, 2.0 / 12) ≈ 1.122`
- `tempoRatio = 1.0`
- Early exit check: `|1.122 - 1.0| < 0.001` → FALSE. Good, continues.
- `stretchTempo = 1.0 / 1.122 ≈ 0.891`
- `resampleRatio = 1.122`
- Calls `stretch(input, 0.891)` → time-stretches to make audio ~12% longer
- Calls `resample(stretchedData, 1.122)` → resamples to shift pitch up, shortening back

This should produce a pitch-shifted buffer of approximately the same length. **The DSP math is correct.**

So if the DSP is correct and the worker binding chain is correct... let me look for the REAL failure point.

---

### Bug #1 (CONFIRMED) — `loadSample()` Cache Poisoning + Async Race

Re-reading [SamplerEngine.ts:78-83](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts#L78-L83) one more time:

```typescript
const stretchedId = `${channelId}_stretched`;
this.sampleRegistry.loadSample(stretchedId, new ArrayBuffer(0)).catch(() => {});
(this.sampleRegistry as any).sampleBuffers.set(stretchedId, buffer);
this.channelSampleIds[channelId] = stretchedId;
```

On the FIRST call:
1. `loadSample(stretchedId, new ArrayBuffer(0))` → tries to `decodeAudioData(new ArrayBuffer(0))` → **fails** → `.catch()` swallows
2. Line 80 force-sets buffer → ✅ works
3. `channelSampleIds[channelId] = stretchedId` → ✅ works
4. First playback uses the stretched buffer → ✅ works

On the SECOND call (user changed pitch knob):
1. `loadSample(stretchedId, new ArrayBuffer(0))` → finds existing entry (from step 2 above) → **returns the OLD buffer immediately** → Promise resolves
2. Line 80 force-sets the NEW buffer → ✅ this still works because it's synchronous
3. `channelSampleIds[channelId] = stretchedId` → already set → no change

So the buffer IS being updated. The channelSampleIds IS pointing to the stretched ID. When `noteOn` fires at line 217, it reads `this.channelSampleIds[channelId]` which is the `_stretched` ID, then calls `getSampleBuffer()` which returns whatever is currently in the map...

**The stored buffer IS being updated correctly.** Let me look at this from a different angle.

---

### Bug #1 (ACTUALLY CONFIRMED) — The `stretchMode` Guard + `calculateTempoRatio` Interaction

When `stretchMode === "stretch"` and the worker produces a pre-stretched buffer, the playback functions apply **additional** tempo compensation on top:

In [noteOn at line 256-258](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts#L255-L258):
```typescript
let resampleTempoRatio = 1.0;
if (settings.stretchMode === "resample") {
  resampleTempoRatio = this.calculateTempoRatio(channelId, buffer.duration);
}
```

When mode is `"stretch"`, `resampleTempoRatio` stays `1.0`. The playback rate is:
```typescript
source.playbackRate.setValueAtTime(Math.pow(2, finalTransposition / 12) * resampleTempoRatio, now);
```

Where `finalTransposition = notePitchOffset + settings.pitch`. The `settings.pitch` is the **main sampler pitch knob** (semitones), NOT the time-stretch pitch. So when the user adjusts the **Time Stretch Pitch knob** (`stretchPitch` in cents), it goes to the worker and comes back as a processed buffer. That's correct — the pitch should be baked into the buffer.

**But the `settings.pitch` (main semitone transpose knob) still gets applied at playback time via `playbackRate`.** This means:
- Main PITCH knob → applied via playbackRate → audible ✅
- Stretch PITCH knob → applied via worker DSP → should be audible if worker output is used ✅
- Stretch MUL knob → changes tempoRatio → sent to worker → should change duration ✅

Wait, let me check if **the worker is actually being invoked** on pitch/mul changes. The flow is:

1. User turns Pitch cents knob → `updateSetting("stretchPitch", v)` in [Sampler.tsx:534](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/plugins/Sampler.tsx#L534)
2. Calls `engine.updateChannelSamplerSettings(channelId, nextSettings)` at [line 218](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/plugins/Sampler.tsx#L218)
3. This hits [SamplerEngine.ts:173-185](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts#L173-L185) which debounces and calls `processSampleStretch(channelId)`
4. Inside `processSampleStretch`, line 126 checks `if (settings.stretchMode !== "stretch")` → if mode is `"stretch"`, this is FALSE, so it **continues past the guard** → ✅
5. Worker fires with updated `pitchCents` and `tempoRatio`

So the worker DOES fire. The processed buffer DOES get stored. The playback DOES read from the stretched ID...

**Let me check one more thing**: Is there a case where `stretchMode` is undefined or missing?

In [Sampler.tsx:32](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/plugins/Sampler.tsx#L32), the default is `"resample"`. If the user hasn't explicitly switched to `"stretch"` mode, then `settings.stretchMode` is `"resample"`, and the guard at line 126 (`settings.stretchMode !== "stretch"`) evaluates to TRUE → **early return, worker never fires**.

> [!IMPORTANT]
> **This is the primary issue**: The Pitch and Multiplier knobs only feed the worker when `stretchMode === "stretch"`. If the user is in `"resample"` mode (the default), knob changes trigger `updateChannelSamplerSettings` → `processSampleStretch` → **early return** at line 126, and then `calculateTempoRatio` at playback time only considers `stretchTime` and `stretchMul`, NOT `stretchPitch`. The pitch cents are completely ignored in resample mode.

---

## Confirmed Root Causes

### 1. `stretchPitch` (cents) Is Ignored in Resample Mode

In [SamplerEngine.ts:96-112](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts#L96-L112), `calculateTempoRatio()` only considers `stretchTime` and `stretchMul`:

```typescript
public calculateTempoRatio(channelId: string, originalDuration: number): number {
  const settings = this.samplerSettings[channelId];
  // ...
  const timeInBeats = settings.stretchTime || 0;
  const multiplier = settings.stretchMul || 1.0;
  // pitchCents is NEVER referenced here
  // ...
  return baseTempoRatio * multiplier;
}
```

And the playback rate formula at [line 260](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts#L260):
```typescript
source.playbackRate.setValueAtTime(
  Math.pow(2, finalTransposition / 12) * resampleTempoRatio, now
);
```

`finalTransposition` uses `settings.pitch` (the main semitone knob), NOT `settings.stretchPitch`. So `stretchPitch` cents are **never applied** in resample mode — they're simply stored and forgotten.

### 2. In Stretch Mode, the Worker Fires But Playback May Use Stale Voices

When the user is in stretch mode AND the timeline is already playing, the new stretched buffer arrives asynchronously but any already-scheduled or actively-playing `BufferSourceNode` voices still reference the **old** buffer object. Web Audio `BufferSourceNode.buffer` is immutable after `start()`. New triggers will pick up the new buffer, but ongoing playback won't change.

This is expected behavior for a DAW, but it means the user has to **re-trigger** (replay) to hear the pitch change. This might be what the user perceives as "zero audible effect."

---

## Proposed Changes

### [SamplerEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts)

#### Fix 1: Apply `stretchPitch` in Resample Mode via `playbackRate`

In resample mode, `stretchPitch` cents should be folded into the playback rate alongside the main pitch knob and tempo ratio. Modify all three playback functions (`noteOn`, `triggerSample`, `triggerCanvasSample`) and `previewChannel` to incorporate `stretchPitch`:

```diff
 // In noteOn (line ~253-260):
 const notePitchOffset = midiNote - 60;
-const finalTransposition = notePitchOffset + (settings.pitch || 0);
+const stretchPitchSemitones = (settings.stretchPitch || 0) / 100;
+const finalTransposition = notePitchOffset + (settings.pitch || 0) + stretchPitchSemitones;
```

Apply the same change in `triggerSample` (line ~520) and `previewChannel` (line ~402).

For `triggerCanvasSample`, there's currently no pitch offset applied at all (line 629 only applies tempo). Add pitch handling there too.

#### Fix 2: Clean Up the `sampleRegistry.loadSample` Hack

Replace the hacky `loadSample(stretchedId, new ArrayBuffer(0))` + force-set with a direct public method or just the force-set alone (since the `loadSample` with empty data serves no purpose and can cause `decodeAudioData` errors):

```diff
 // In worker onmessage handler (line ~78-80):
-this.sampleRegistry.loadSample(stretchedId, new ArrayBuffer(0)).catch(() => {});
-(this.sampleRegistry as any).sampleBuffers.set(stretchedId, buffer);
+// Directly register the pre-decoded AudioBuffer in the sample cache
+(this.sampleRegistry as any).sampleBuffers.set(stretchedId, buffer);
```

---

### [SampleRegistry.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SampleRegistry.ts)

#### Fix 3: Add a public `setSampleBuffer` method

Instead of using the `(this.sampleRegistry as any)` escape hatch to access the private `sampleBuffers` map, add a proper public method:

```typescript
public setSampleBuffer(id: string, buffer: AudioBuffer): void {
  this.sampleBuffers.set(id, buffer);
  this.touchAccessOrder(id);
  this.evictIfNeeded();
}
```

---

## Files Modified

| File | Change |
|------|--------|
| [SamplerEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts) | Apply `stretchPitch` cents in resample-mode playback rate; clean up registry hack; use new `setSampleBuffer` |
| [SampleRegistry.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SampleRegistry.ts) | Add `setSampleBuffer()` public method |

## Verification Plan

### Automated Tests
```bash
npx tsc --noEmit
```

### Manual Verification
1. Open the Sampler plugin, load a sample
2. Set stretch mode to **RESAMPLE**, adjust the Pitch knob (cents) → verify pitch changes audibly on next trigger
3. Set stretch mode to **RESAMPLE**, adjust the MUL knob → verify duration/speed changes
4. Set stretch mode to **STRETCH**, adjust the Pitch knob → verify pitch changes after worker processing completes
5. Set stretch mode to **STRETCH**, adjust the MUL knob → verify duration changes
6. Verify canvas clip playback and timeline playback both respect the stretch settings
