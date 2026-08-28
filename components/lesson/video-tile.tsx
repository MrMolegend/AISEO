'use client';

import { useEffect, useRef } from 'react';
import { MicOff, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A participant tile. When a real local stream exists it plays it; otherwise it
 * falls back to initials on a tinted ground — which is what the remote tile
 * always shows, because nobody is actually connected.
 */
export function VideoTile({
  name,
  role,
  initials,
  stream,
  cameraOn,
  micOn,
  isLocal,
  speaking,
  className,
}: {
  name: string;
  role: string;
  initials: string;
  stream?: MediaStream | null;
  cameraOn: boolean;
  micOn: boolean;
  isLocal?: boolean;
  speaking?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.srcObject = stream ?? null;
  }, [stream]);

  const showVideo = Boolean(stream) && cameraOn;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-[var(--radius-panel)] border bg-[#101a30]',
        speaking ? 'border-[#8f9dff]' : 'border-white/10',
        className,
      )}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="size-full object-cover"
          aria-label={`${name}'s camera`}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 px-4 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold text-white">
            {initials}
          </span>
          {!cameraOn && (
            <span className="flex items-center gap-1.5 text-xs text-white/60">
              <VideoOff className="size-3.5" aria-hidden />
              Camera off
            </span>
          )}
          {cameraOn && isLocal && !stream && (
            <span className="max-w-52 text-xs leading-relaxed text-white/50">
              Camera preview not started — use the settings panel to allow access.
            </span>
          )}
        </div>
      )}

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {name}
          <span className="font-normal text-white/60">· {role}</span>
          {isLocal && <span className="text-white/60">· you</span>}
        </span>
        {!micOn && (
          <span className="flex size-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <MicOff className="size-3.5" aria-hidden />
            <span className="sr-only">{name} is muted</span>
          </span>
        )}
      </div>
    </div>
  );
}
