/**
 * timingEngine.js
 * DEV TICKET #1 — Timing Controller
 *
 * Small scheduler that coordinates the 2.7-second cinematic sequence.
 * Supports: schedule(callback, delay), clearAll(), internal tracking of active timers.
 */

const activeTimers = [];

/**
 * Schedule a callback after a delay (ms).
 * Returns the timer ID.
 */
export function schedule(callback, delay) {
  const id = setTimeout(() => {
    callback();
    // Remove from active list once fired
    const idx = activeTimers.indexOf(id);
    if (idx > -1) activeTimers.splice(idx, 1);
  }, delay);
  activeTimers.push(id);
  return id;
}

/**
 * Clear all active timers.
 */
export function clearAll() {
  activeTimers.forEach((id) => clearTimeout(id));
  activeTimers.length = 0;
}

/**
 * Returns count of currently active timers.
 */
export function size() {
  return activeTimers.length;
}
