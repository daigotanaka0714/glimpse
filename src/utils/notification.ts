/**
 * 通知音を再生するユーティリティ
 * Web Audio APIを使用してシンプルな通知音を生成
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * 完了通知音を再生
 * 心地よい2音のチャイム音
 */
export function playCompletionSound(): void {
  try {
    const ctx = getAudioContext();

    // 音が鳴らない場合はコンテキストを再開
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // 1音目（ド）
    playTone(ctx, 523.25, now, 0.15, 0.3); // C5

    // 2音目（ソ）- 少し遅れて
    playTone(ctx, 783.99, now + 0.15, 0.2, 0.25); // G5
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
  }
}

/**
 * 単音を再生
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

  // フェードイン・フェードアウトで滑らかに
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

/**
 * エラー通知音を再生（必要に応じて）
 */
export function playErrorSound(): void {
  try {
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // 低めの警告音
    playTone(ctx, 220, now, 0.15, 0.2); // A3
    playTone(ctx, 196, now + 0.15, 0.2, 0.2); // G3
  } catch (error) {
    console.warn('Failed to play error sound:', error);
  }
}
