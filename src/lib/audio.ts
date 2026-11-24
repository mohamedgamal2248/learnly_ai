import { speak } from "./learn-client";

let current: HTMLAudioElement | null = null;

/** Plays the pre-made English audio (works offline once heard). If the file cannot play, the phone's own voice is used. */
export function playAudio(id: string | null | undefined, fallbackText: string) {
  try { speechSynthesis.cancel(); } catch {}
  if (!id) { speak(fallbackText); return; }
  try {
    if (current) { current.pause(); current = null; }
    const a = new Audio(`/audio/${id}.mp3`);
    current = a;
    a.play().catch(() => speak(fallbackText));
    a.onerror = () => speak(fallbackText);
  } catch { speak(fallbackText); }
}
