'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { demoLessonProvider, type LocalMediaResult } from './provider';

type Status = 'idle' | 'requesting' | 'ready' | 'blocked';

/**
 * Owns the lifetime of the local camera and microphone.
 *
 * Three rules the room depends on: nothing is requested until the visitor
 * clicks, a refusal is a normal state rather than an error, and every track is
 * stopped when the component unmounts so the browser's recording indicator does
 * not stay on.
 */
export function useLocalCamera() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<LocalMediaResult['error']>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    demoLessonProvider.stopLocalMedia(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setStatus('idle');
  }, []);

  const request = useCallback(async (options: { video: boolean; audio: boolean }) => {
    setStatus('requesting');
    setError(null);
    const result = await demoLessonProvider.requestLocalMedia(options);

    if (!result.stream) {
      setError(result.error);
      setStatus('blocked');
      return result;
    }

    demoLessonProvider.stopLocalMedia(streamRef.current);
    streamRef.current = result.stream;
    setStream(result.stream);
    setStatus('ready');
    return result;
  }, []);

  /** Mutes or unmutes tracks in place rather than re-prompting for permission. */
  const setTrackEnabled = useCallback((kind: 'video' | 'audio', enabled: boolean) => {
    const tracks =
      kind === 'video'
        ? streamRef.current?.getVideoTracks()
        : streamRef.current?.getAudioTracks();
    tracks?.forEach((track) => {
      track.enabled = enabled;
    });
  }, []);

  useEffect(() => {
    return () => {
      demoLessonProvider.stopLocalMedia(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  return { status, error, stream, request, stop, setTrackEnabled };
}
