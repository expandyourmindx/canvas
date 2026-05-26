/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Headless DAW Audio Engine- High-Precision Scheduler Web Worker (scheduler.worker.ts)
 * 
 * DESIGN PRINCIPLE:
 * In web browsers, the main JavaScript execution thread is shared with layout, rendering,
 * and user interactions. If the main thread blocks (due to CPU-heavy rendering or complex UI processes),
 * standard timers like `setInterval` or `setTimeout` will drift, stutter, or freeze.
 * 
 * To ensure professional-grade, sample-accurate transport timing, we run this dedicated Web Worker
 * in an entirely separate OS-level thread. Since this worker has no access to the page's DOM,
 * it cannot be starved under main-thread UI stress, guaranteeing extremely stable clock ticks.
 * 
 * All this worker does is maintain an active steady timer and post "tick" messages back to the
 * main-thread AudioEngine, which acts as the high-priority audio scheduler.
 */

// Define the private state of the worker thread
let timerId: ReturnType<typeof setInterval> | null = null;
let tickIntervalMs: number = 25; // Default scheduling pulse interval is 25ms (40 ticks per second)

// Listen to control commands transmitted from the main AudioEngine thread
self.onmessage = (event: MessageEvent) => {
  const { action, interval } = event.data;

  switch (action) {
    case "start":
      // Commences the internal transport pulse generator
      if (!timerId) {
        timerId = setInterval(() => {
          self.postMessage({ type: "tick" });
        }, tickIntervalMs);
      }
      break;

    case "stop":
      // Halts the internal transport pulse generator
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      break;

    case "setInterval":
      // Real-time adjustment of the scheduling pulse precision
      if (typeof interval === "number" && interval > 0) {
        tickIntervalMs = interval;
        if (timerId) {
          // Hot-swap the running timer interval to avoid timing glitches
          clearInterval(timerId);
          timerId = setInterval(() => {
            self.postMessage({ type: "tick" });
          }, tickIntervalMs);
        }
      }
      break;
  }
};
