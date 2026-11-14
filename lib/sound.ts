"use client";

const SOUND_MUTE_STORAGE_KEY = "satmi-sound-muted-v1";

let cachedMuted: boolean | null = null;
let sharedAudioContext: AudioContext | null = null;
const lastPlayedByType: Record<string, number> = {};

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedAudioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export function isSoundMuted(): boolean {
  if (cachedMuted !== null) return cachedMuted;
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SOUND_MUTE_STORAGE_KEY);
    cachedMuted = raw === "true";
    return cachedMuted;
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  cachedMuted = Boolean(muted);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOUND_MUTE_STORAGE_KEY, String(cachedMuted));
  } catch {}
}

export function toggleSoundMuted(): boolean {
  const next = !isSoundMuted();
  setSoundMuted(next);
  if (!next) {
    // Play a soft confirmation chime when unmuted
    playNotificationSound("task");
  }
  return next;
}

/**
 * Synthesizes an audible notification chime using Web Audio API.
 * - 'task': Pleasant rising dual-tone harmonic chime when a new task is allotted.
 * - 'reminder': Distinct double-bell alert chime when a reminder is due.
 */
export function playNotificationSound(type: "task" | "reminder" = "task"): void {
  if (typeof window === "undefined") return;
  if (isSoundMuted()) return;

  const nowMs = Date.now();
  const lastMs = lastPlayedByType[type] || 0;
  if (nowMs - lastMs < 500) {
    // Coalesce burst triggers (e.g. batch template task creation) into a single clean chime
    return;
  }
  lastPlayedByType[type] = nowMs;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === "reminder") {
      // Distinct two-pulse bell chime (A5 -> D6 repeated)
      const notes = [
        { freq: 880, start: 0, duration: 0.14 },
        { freq: 1174.66, start: 0.12, duration: 0.22 },
        { freq: 880, start: 0.36, duration: 0.14 },
        { freq: 1174.66, start: 0.48, duration: 0.28 },
      ];

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(note.freq, now + note.start);

        gain.gain.setValueAtTime(0.0001, now + note.start);
        gain.gain.exponentialRampToValueAtTime(0.18, now + note.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + note.start);
        osc.stop(now + note.start + note.duration + 0.02);
      }
      return;
    }

    // Default 'task': Pleasant dual-tone chime (C5 -> E5 -> G5 soft harmonic)
    const tones = [
      { freq: 587.33, start: 0, duration: 0.18 }, // D5
      { freq: 880.0, start: 0.11, duration: 0.32 }, // A5
    ];

    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.16, now + tone.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.duration + 0.02);
    }
  } catch {
    // Ignore autoplay restrictions or unsupported audio context errors
  }
}
