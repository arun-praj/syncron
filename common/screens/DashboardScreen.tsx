import { AvatarStack } from "~common/components/Avatar"
import { Badge } from "~common/components/Badge"
import { Button } from "~common/components/Button"
import { Card } from "~common/components/Card"
import { Logo } from "~common/components/Logo"
import { useAuth } from "~common/state/AuthContext"
import { useRoom } from "~common/state/RoomContext"

export default function DashboardScreen() {
  const { user, logout } = useAuth()
  const { state, room, participants, createRoom, joinRoom, leaveRoom } = useRoom()

  return (
    <div className="flex flex-col px-[22px] pb-[18px] pt-[22px]">
      <div className="mb-5 flex items-center justify-between">
        <Logo />
        <button
          type="button"
          onClick={logout}
          className="text-[11px] text-ink-secondary hover:text-ink-primary hover:underline">
          Sign out
        </button>
      </div>

      {state === "empty" ? (
        <Card className="flex flex-col items-center gap-1 py-8 text-center">
          <p className="text-[15px] font-bold text-ink-primary">Not watching anything yet</p>
          <p className="mb-4 text-subtext text-ink-secondary">
            Create a room and share the link, or join one a friend sent you.
          </p>
          <Button onClick={createRoom}>Create a room</Button>
          <Button variant="secondary" onClick={joinRoom} className="mt-2">
            Join a room
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <div>
            <Badge status="synced" />
            <p className="mt-2 line-clamp-2 text-input font-medium text-ink-primary">
              {room?.videoTitle}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <AvatarStack
              users={participants.map((p) => ({
                name: p.name,
                initials: p.initials,
                color: p.avatarColor
              }))}
            />
            <span className="text-[11px] text-ink-secondary">
              {participants.length} watching
            </span>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1">Open chat</Button>
            <Button variant="secondary" className="flex-1">
              Start call
            </Button>
          </div>

          <button
            type="button"
            onClick={leaveRoom}
            className="text-[11px] text-ink-secondary hover:text-red-500 hover:underline">
            Leave room
          </button>
        </Card>
      )}

      <p className="mt-4 text-center text-[11px] text-ink-placeholder">
        Signed in as {user?.email}
      </p>
    </div>
  )
}
