import { IconButton } from "~common/components/IconButton"
import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenShareIcon,
  VideoIcon,
  VideoOffIcon
} from "~common/components/icons"

interface CallControlsProps {
  muted: boolean
  cameraOff: boolean
  onToggleMute: () => void
  onToggleCamera: () => void
  onEndCall: () => void
}

export function CallControls({
  muted,
  cameraOff,
  onToggleMute,
  onToggleCamera,
  onEndCall
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 border-t border-border p-3">
      <IconButton
        active={muted}
        onClick={onToggleMute}
        icon={muted ? <MicOffIcon /> : <MicIcon />}
        aria-label="Toggle mute"
      />
      <IconButton
        active={cameraOff}
        onClick={onToggleCamera}
        icon={cameraOff ? <VideoOffIcon /> : <VideoIcon />}
        aria-label="Toggle camera"
      />
      <IconButton icon={<ScreenShareIcon />} aria-label="Share screen" />
      <IconButton
        variant="danger"
        onClick={onEndCall}
        icon={<PhoneOffIcon />}
        aria-label="End call"
      />
    </div>
  )
}
