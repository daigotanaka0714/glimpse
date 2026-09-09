import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Note: notification.ts talks to the Web Audio API, not to Tauri IPC, so the
// mock target here is a stubbed global AudioContext. The Tauri APIs themselves
// are mocked globally in test/setup.ts, which every test file picks up.
//
// The module keeps a lazily-created AudioContext in module scope, so each test
// resets the module registry and re-imports to get a fresh singleton.

const NOW = 10;

function createMockOscillator() {
  return {
    type: '',
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function createMockGainNode() {
  return {
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
}

type MockOscillator = ReturnType<typeof createMockOscillator>;
type MockGainNode = ReturnType<typeof createMockGainNode>;

function createMockAudioContext(state: 'running' | 'suspended' = 'running') {
  const oscillators: MockOscillator[] = [];
  const gainNodes: MockGainNode[] = [];

  return {
    state,
    currentTime: NOW,
    destination: { id: 'destination' },
    resume: vi.fn(),
    createOscillator: vi.fn(() => {
      const oscillator = createMockOscillator();
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => {
      const gainNode = createMockGainNode();
      gainNodes.push(gainNode);
      return gainNode;
    }),
    oscillators,
    gainNodes,
  };
}

type MockAudioContext = ReturnType<typeof createMockAudioContext>;

let mockContext: MockAudioContext;
let audioContextConstructor: Mock<() => MockAudioContext>;

/** Import the module under test with a fresh module-level AudioContext. */
async function importNotification() {
  vi.resetModules();
  return import('./notification');
}

beforeEach(() => {
  mockContext = createMockAudioContext();
  audioContextConstructor = vi.fn(() => mockContext);
  // `new` on a plain vi.fn() yields a fresh instance rather than the mock's
  // return value, so wrap it: returning an object from a constructor wins.
  vi.stubGlobal('AudioContext', function AudioContextStub() {
    return audioContextConstructor();
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('notification sounds', () => {
  describe('playCompletionSound', () => {
    it('should play a two-tone chime (C5 then G5)', async () => {
      const { playCompletionSound } = await importNotification();

      playCompletionSound();

      expect(mockContext.oscillators).toHaveLength(2);
      const [first, second] = mockContext.oscillators;
      expect(first.frequency.setValueAtTime).toHaveBeenCalledWith(523.25, NOW);
      expect(second.frequency.setValueAtTime).toHaveBeenCalledWith(783.99, NOW + 0.15);
    });

    it('should schedule the second tone after the first', async () => {
      const { playCompletionSound } = await importNotification();

      playCompletionSound();

      const [first, second] = mockContext.oscillators;
      expect(first.start).toHaveBeenCalledWith(NOW);
      expect(first.stop).toHaveBeenCalledWith(NOW + 0.15);
      expect(second.start).toHaveBeenCalledWith(NOW + 0.15);
      expect(second.stop).toHaveBeenCalledWith(NOW + 0.15 + 0.2);
    });

    it('should use sine oscillators routed through a gain node to the destination', async () => {
      const { playCompletionSound } = await importNotification();

      playCompletionSound();

      expect(mockContext.gainNodes).toHaveLength(2);
      mockContext.oscillators.forEach((oscillator, index) => {
        expect(oscillator.type).toBe('sine');
        expect(oscillator.connect).toHaveBeenCalledWith(mockContext.gainNodes[index]);
      });
      mockContext.gainNodes.forEach((gainNode) => {
        expect(gainNode.connect).toHaveBeenCalledWith(mockContext.destination);
      });
    });

    it('should fade each tone in and out', async () => {
      const { playCompletionSound } = await importNotification();

      playCompletionSound();

      const [firstGain] = mockContext.gainNodes;
      expect(firstGain.gain.setValueAtTime).toHaveBeenCalledWith(0, NOW);
      expect(firstGain.gain.linearRampToValueAtTime).toHaveBeenNthCalledWith(1, 0.3, NOW + 0.02);
      expect(firstGain.gain.linearRampToValueAtTime).toHaveBeenNthCalledWith(2, 0, NOW + 0.15);
    });

    it('should resume a suspended audio context', async () => {
      mockContext = createMockAudioContext('suspended');
      audioContextConstructor.mockReturnValue(mockContext);
      const { playCompletionSound } = await importNotification();

      playCompletionSound();

      expect(mockContext.resume).toHaveBeenCalledTimes(1);
    });

    it('should not resume an already running audio context', async () => {
      const { playCompletionSound } = await importNotification();

      playCompletionSound();

      expect(mockContext.resume).not.toHaveBeenCalled();
    });

    it('should reuse a single audio context across calls', async () => {
      const { playCompletionSound } = await importNotification();

      playCompletionSound();
      playCompletionSound();

      expect(audioContextConstructor).toHaveBeenCalledTimes(1);
      expect(mockContext.oscillators).toHaveLength(4);
    });

    it('should warn instead of throwing when the audio context is unavailable', async () => {
      audioContextConstructor.mockImplementation(() => {
        throw new Error('no audio device');
      });
      const { playCompletionSound } = await importNotification();

      expect(() => playCompletionSound()).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to play notification sound:',
        expect.any(Error)
      );
    });
  });

  describe('playErrorSound', () => {
    it('should play a low two-tone warning (A3 then G3)', async () => {
      const { playErrorSound } = await importNotification();

      playErrorSound();

      expect(mockContext.oscillators).toHaveLength(2);
      const [first, second] = mockContext.oscillators;
      expect(first.frequency.setValueAtTime).toHaveBeenCalledWith(220, NOW);
      expect(second.frequency.setValueAtTime).toHaveBeenCalledWith(196, NOW + 0.15);
    });

    it('should resume a suspended audio context', async () => {
      mockContext = createMockAudioContext('suspended');
      audioContextConstructor.mockReturnValue(mockContext);
      const { playErrorSound } = await importNotification();

      playErrorSound();

      expect(mockContext.resume).toHaveBeenCalledTimes(1);
    });

    it('should warn instead of throwing when the audio context is unavailable', async () => {
      audioContextConstructor.mockImplementation(() => {
        throw new Error('no audio device');
      });
      const { playErrorSound } = await importNotification();

      expect(() => playErrorSound()).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith('Failed to play error sound:', expect.any(Error));
    });
  });

  describe('shared audio context', () => {
    it('should share one context between completion and error sounds', async () => {
      const { playCompletionSound, playErrorSound } = await importNotification();

      playCompletionSound();
      playErrorSound();

      expect(audioContextConstructor).toHaveBeenCalledTimes(1);
    });
  });
});
