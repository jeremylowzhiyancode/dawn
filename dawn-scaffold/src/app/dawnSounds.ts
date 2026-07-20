"use client";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function playNote(
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
}

/** Soft upward blip when you send a message. */
export function playDawnSendSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  playNote(392, t, 0.09, 0.045);
  playNote(523.25, t + 0.05, 0.11, 0.035);
}

/** Warm little chime when Dawn replies. */
export function playDawnReceiveSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  playNote(329.63, t, 0.14, 0.04);
  playNote(440, t + 0.07, 0.16, 0.034);
  playNote(554.37, t + 0.13, 0.2, 0.028);
}
