/**
 * Notification sound utility
 * Uses Web Audio API to generate simple notification sounds
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play completion notification sound
 * A pleasant 2-tone chime
 */
export function playCompletionSound(): void {
  try {
    const ctx = getAudioContext();

    // Resume context if sound doesn't play
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First tone (C)
    playTone(ctx, 523.25, now, 0.15, 0.3); // C5

    // Second tone (G) - slightly delayed
    playTone(ctx, 783.99, now + 0.15, 0.2, 0.25); // G5
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
  }
}

/**
 * Play a single tone
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);

  // Smooth fade in/out
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

/**
 * Play error notification sound (if needed)
 */
export function playErrorSound(): void {
  try {
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Low warning tone
    playTone(ctx, 220, now, 0.15, 0.2); // A3
    playTone(ctx, 196, now + 0.15, 0.2, 0.2); // G3
  } catch (error) {
    console.warn('Failed to play error sound:', error);
  }
}
