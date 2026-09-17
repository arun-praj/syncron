import { createContext, useContext, useState, type ReactNode } from "react"

import { mockParticipants, mockRoom, type MockUser } from "~common/lib/mock-data"

type RoomState = "empty" | "active"

interface RoomContextValue {
  state: RoomState
  room: typeof mockRoom | null
  participants: MockUser[]
  createRoom: () => void
  joinRoom: () => void
  leaveRoom: () => void
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined)

// Mock room state only — Create/Join just flips between "empty" and
// "active" locally. Real room creation/join over the backend's API +
// WebSocket happens in a follow-up pass.
export function RoomProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoomState>("empty")

  const value: RoomContextValue = {
    state,
    room: state === "active" ? mockRoom : null,
    participants: state === "active" ? mockParticipants : [],
    createRoom: () => setState("active"),
    joinRoom: () => setState("active"),
    leaveRoom: () => setState("empty")
  }

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

export function useRoom() {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error("useRoom must be used within RoomProvider")
  return ctx
}
