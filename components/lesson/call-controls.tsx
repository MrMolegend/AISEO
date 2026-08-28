'use client';

import {
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  NotebookPen,
  PhoneOff,
  Settings,
  Video,
  VideoOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PanelId = 'chat' | 'notes' | 'objectives' | 'settings' | null;

interface ControlProps {
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  panel: PanelId;
  layout: 'grid' | 'focus';
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleShare: () => void;
  onPanel: (panel: PanelId) => void;
  onToggleLayout: () => void;
  onLeave: () => void;
}

function ControlButton({
  label,
  active,
  danger,
  onClick,
  children,
  pressed,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors duration-[var(--duration-fast)] active:translate-y-px',
        danger
          ? 'border-transparent bg-[#c2414b] text-white hover:brightness-110'
          : active
            ? 'border-transparent bg-white text-[#14213a] hover:bg-white/90'
            : 'border-white/15 bg-white/10 text-white hover:bg-white/20',
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * The call bar. Every control changes something you can see: the tiles, the
 * side panel or the layout. Nothing here is decorative.
 */
export function CallControls({
  micOn,
  cameraOn,
  sharing,
  panel,
  layout,
  onToggleMic,
  onToggleCamera,
  onToggleShare,
  onPanel,
  onToggleLayout,
  onLeave,
}: ControlProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
      <ControlButton
        label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        pressed={!micOn}
        onClick={onToggleMic}
      >
        {micOn ? (
          <Mic className="size-5" aria-hidden />
        ) : (
          <MicOff className="size-5" aria-hidden />
        )}
      </ControlButton>

      <ControlButton
        label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
        pressed={!cameraOn}
        onClick={onToggleCamera}
      >
        {cameraOn ? (
          <Video className="size-5" aria-hidden />
        ) : (
          <VideoOff className="size-5" aria-hidden />
        )}
      </ControlButton>

      <ControlButton
        label={sharing ? 'Stop sharing your screen' : 'Share your screen'}
        active={sharing}
        pressed={sharing}
        onClick={onToggleShare}
      >
        <MonitorUp className="size-5" aria-hidden />
      </ControlButton>

      <ControlButton
        label="Lesson chat"
        active={panel === 'chat'}
        pressed={panel === 'chat'}
        onClick={() => onPanel(panel === 'chat' ? null : 'chat')}
      >
        <MessageSquare className="size-5" aria-hidden />
      </ControlButton>

      <ControlButton
        label="Shared notes"
        active={panel === 'notes'}
        pressed={panel === 'notes'}
        onClick={() => onPanel(panel === 'notes' ? null : 'notes')}
      >
        <NotebookPen className="size-5" aria-hidden />
      </ControlButton>

      <ControlButton
        label={layout === 'grid' ? 'Switch to focus layout' : 'Switch to grid layout'}
        pressed={layout === 'focus'}
        onClick={onToggleLayout}
      >
        <LayoutGrid className="size-5" aria-hidden />
      </ControlButton>

      <ControlButton
        label="Devices and settings"
        active={panel === 'settings'}
        pressed={panel === 'settings'}
        onClick={() => onPanel(panel === 'settings' ? null : 'settings')}
      >
        <Settings className="size-5" aria-hidden />
      </ControlButton>

      <ControlButton label="Leave lesson" danger onClick={onLeave}>
        <PhoneOff className="size-5" aria-hidden />
      </ControlButton>
    </div>
  );
}
