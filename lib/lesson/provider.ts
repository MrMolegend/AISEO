/**
 * The lesson-room provider boundary.
 *
 * Everything the room needs from a video service sits behind this interface:
 * getting a local camera and microphone, releasing them again, and reporting
 * connection quality. The room component talks to the interface only.
 *
 * TODO(integration): implement `LessonRoomProvider` against Daily (or LiveKit)
 * — `requestLocalMedia` becomes the call object's device request, and joining a
 * room needs a short-lived access token minted server-side. Nothing else in
 * `components/lesson` should have to change.
 */

export type ConnectionQuality = 'excellent' | 'good' | 'poor';

export interface LocalMediaResult {
  stream: MediaStream | null;
  /** Why there is no stream: the visitor said no, or the browser cannot. */
  error: 'denied' | 'unavailable' | 'unsupported' | null;
}

export interface LessonRoomProvider {
  readonly name: string;
  /** False for the demo provider — the UI says so rather than implying a call. */
  readonly isLive: boolean;
  requestLocalMedia(options: {
    video: boolean;
    audio: boolean;
  }): Promise<LocalMediaResult>;
  stopLocalMedia(stream: MediaStream | null): void;
  connectionQuality(): ConnectionQuality;
}

/**
 * The demonstration provider. It will show a genuine self-view when the visitor
 * explicitly allows the camera, and works perfectly well when they refuse — the
 * tile falls back to their initials. It never attempts a peer connection,
 * because a fake one would be worse than an honest placeholder.
 */
export const demoLessonProvider: LessonRoomProvider = {
  name: 'Local demonstration',
  isLive: false,

  async requestLocalMedia({ video, audio }) {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      (!video && !audio)
    ) {
      return { stream: null, error: 'unsupported' };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      return { stream, error: null };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        return { stream: null, error: 'denied' };
      }
      return { stream: null, error: 'unavailable' };
    }
  },

  stopLocalMedia(stream) {
    stream?.getTracks().forEach((track) => track.stop());
  },

  connectionQuality() {
    return 'excellent';
  },
};

export const QUALITY_LABEL: Record<ConnectionQuality, string> = {
  excellent: 'Connection strong',
  good: 'Connection steady',
  poor: 'Connection unstable',
};
