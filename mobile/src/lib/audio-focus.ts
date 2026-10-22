import type { AudioLockScreenOptions, AudioMetadata, AudioPlayer, AudioSource } from 'expo-audio';

/** Anything that plays: a single-track player (Azan) or a playlist (Quran, duas). */
type Playable = {
  play(): void;
  pause(): void;
  setActiveForLockScreen?(active: boolean, metadata?: AudioMetadata, options?: AudioLockScreenOptions): void;
};

/** What the lock screen / notification shade shows while it plays (and keeps it playing in the background). */
export type LockScreen = { metadata: AudioMetadata; options?: AudioLockScreenOptions };

// The Azan, Quran recitation and after-namaz duas each have their own player, and tabs
// stay mounted, so without this two of them can play over each other. Every play goes through here.
let active: Playable | null = null;

function pauseActive() {
  if (!active) return;
  try {
    active.pause();
  } catch {
    // that player was already released (its screen unmounted)
  }
}

/**
 * Play `player`, pausing whatever else was playing. With `lock`, it also gets the media controls on the
 * lock screen and in the notification shade, which on Android is what keeps it playing with the screen off.
 */
export function playExclusive(player: Playable, lock?: LockScreen) {
  if (active !== player) pauseActive();
  active = player;
  if (lock) {
    try {
      player.setActiveForLockScreen?.(true, lock.metadata, lock.options);
    } catch {
      // not supported here (web); it still plays in the foreground
    }
  }
  player.play();
}

/** Resolves once the player's current source has loaded (or after `timeoutMs`, so we never hang). */
function whenLoaded(player: AudioPlayer, timeoutMs = 5000) {
  return new Promise<void>((resolve) => {
    if (player.isLoaded) return resolve();
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (!s.isLoaded) return;
      sub.remove();
      clearTimeout(timer);
      resolve();
    });
    const timer = setTimeout(() => {
      sub.remove();
      resolve();
    }, timeoutMs);
  });
}

// Each switch gets a number; if another switch happens while we wait for loading, the old one gives up.
let switchId = 0;

/**
 * Switch a single-track `player` to a new source and play it exclusively — only once it has loaded,
 * so the first fraction of a second isn't lost. (Multi-track queues use a playlist instead.)
 */
export async function playSource(player: AudioPlayer, source: AudioSource) {
  const id = ++switchId;
  // Pause first: replace() resumes on its own when the old track was playing.
  player.pause();
  player.replace(source);
  await whenLoaded(player);
  if (id !== switchId) return;
  try {
    await player.seekTo(0);
  } catch {
    // seeking a just-loaded track can fail on some devices; it starts at 0 anyway
  }
  if (id !== switchId) return;
  playExclusive(player);
}

/** Set a player's or playlist's speed (1 = normal). Kept here so screens don't assign to a hook's value. */
export function setPlaybackRate(player: { playbackRate: number }, rate: number) {
  if (player.playbackRate !== rate) player.playbackRate = rate;
}
