/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

#include <emscripten.h>
#include "SoundTouch.h"

using namespace soundtouch;

extern "C" {

/**
 * Instantiates a new SoundTouch processing object.
 * Returns a raw pointer handle to the instance.
 */
EMSCRIPTEN_KEEPALIVE
void* soundtouch_create() {
    return new SoundTouch();
}

/**
 * Safely deletes a SoundTouch processing instance.
 */
EMSCRIPTEN_KEEPALIVE
void soundtouch_destroy(void* handle) {
    delete static_cast<SoundTouch*>(handle);
}

/**
 * Configures the target sample rate (e.g. 44100, 48000).
 */
EMSCRIPTEN_KEEPALIVE
void soundtouch_set_sample_rate(void* handle, int sampleRate) {
    static_cast<SoundTouch*>(handle)->setSampleRate(sampleRate);
}

/**
 * Configures the number of audio channels (e.g. 1 for mono, 2 for stereo).
 */
EMSCRIPTEN_KEEPALIVE
void soundtouch_set_channels(void* handle, int channels) {
    static_cast<SoundTouch*>(handle)->setChannels(channels);
}

/**
 * Sets the time-stretching tempo factor.
 * 1.0 represents normal speed, 0.5 represents half speed, 2.0 represents double speed.
 */
EMSCRIPTEN_KEEPALIVE
void soundtouch_set_tempo(void* handle, float tempo) {
    static_cast<SoundTouch*>(handle)->setTempo(tempo);
}

/**
 * Sets the pitch transpose factor in semitones (e.g. -12.0 to +12.0).
 * 0.0 represents original pitch. Supports fractional pitch/cents transpositions.
 */
EMSCRIPTEN_KEEPALIVE
void soundtouch_set_pitch_semi_tones(void* handle, float pitch) {
    static_cast<SoundTouch*>(handle)->setPitchSemiTones(pitch);
}

/**
 * Feeds raw audio samples (float32 PCM) into the SoundTouch processing queue.
 * Samples should be interleaved for multi-channel audio (e.g. L R L R ...).
 * nSamples represents the number of *frames* (not total floats, so length / channels).
 */
EMSCRIPTEN_KEEPALIVE
void soundtouch_put_samples(void* handle, const float* samples, int numFrames) {
    static_cast<SoundTouch*>(handle)->putSamples(samples, numFrames);
}

/**
 * Retrieves processed audio samples (float32 PCM) from the SoundTouch queue.
 * Returns the number of processed *frames* outputted into outBuffer.
 * outBuffer must be pre-allocated and large enough to hold maxFrames.
 */
EMSCRIPTEN_KEEPALIVE
int soundtouch_receive_samples(void* handle, float* outBuffer, int maxFrames) {
    return static_cast<SoundTouch*>(handle)->receiveSamples(outBuffer, maxFrames);
}

/**
 * Flushes the processing pipeline to force any remaining samples inside
 * the internal buffers to be calculated and made available.
 */
EMSCRIPTEN_KEEPALIVE
void soundtouch_flush(void* handle) {
    static_cast<SoundTouch*>(handle)->flush();
}

/**
 * Clears all internal processing state and clears any remaining samples
 * inside the queues without processing them.
 */
EMSCRIPTEN_KEEPALIVE
void soundtouch_clear(void* handle) {
    static_cast<SoundTouch*>(handle)->clear();
}

}
