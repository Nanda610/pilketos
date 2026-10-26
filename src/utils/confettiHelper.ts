import confetti from 'canvas-confetti';

/**
 * Safe wrapper around canvas-confetti.
 *
 * canvas-confetti's default export automatically creates a Web Worker with an OffscreenCanvas
 * when Worker and OffscreenCanvas are detected in the browser. In many sandboxed or iframe
 * environments (and certain browser versions), the worker blob attempts to call
 * canvas.getBoundingClientRect(), which is not supported on OffscreenCanvas, throwing:
 * "Uncaught TypeError: canvas.getBoundingClientRect is not a function at blob:...".
 *
 * By creating an instance with `useWorker: false`, it uses the standard DOM canvas on document.body,
 * avoiding the broken worker code entirely and ensuring rock-solid celebration animations.
 */
let safeConfettiInstance: confetti.CreateTypes | null = null;

export function safeConfetti(options?: confetti.Options): Promise<null> | null | undefined {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  try {
    if (!safeConfettiInstance) {
      safeConfettiInstance = confetti.create(undefined, {
        resize: true,
        useWorker: false,
      });
    }

    if (safeConfettiInstance) {
      return safeConfettiInstance(options);
    }
    return null;
  } catch (error) {
    console.warn('Celebration confetti failed gracefully:', error);
    return null;
  }
}

export default safeConfetti;
