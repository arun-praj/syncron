// Fixture data for the design pass. None of this is fetched from the real
// backend yet — every screen/panel renders off these fixtures so the UI can
// be reviewed end-to-end before any API/WebSocket wiring happens.

export interface MockUser {
  id: string
  name: string
  email: string
  avatarColor: string
  initials: string
}

export const mockCurrentUser: MockUser = {
  id: "u1",
  name: "Arun",
  email: "arun@example.com",
  avatarColor: "#2563eb",
  initials: "A"
}

export const mockParticipants: MockUser[] = [
  mockCurrentUser,
  {
    id: "u2",
    name: "Priya",
    email: "priya@example.com",
    avatarColor: "#16a34a",
    initials: "P"
  },
  {
    id: "u3",
    name: "Dev",
    email: "dev@example.com",
    avatarColor: "#f59e0b",
    initials: "D"
  }
]

export const mockRoom = {
  id: "room-1",
  videoTitle: "Daft Punk - One More Time (Official Video)",
  isSynced: true
}

export interface MockMessage {
  id: string
  authorId: string
  text: string
  timestamp: string
}

export const mockMessages: MockMessage[] = [
  { id: "m1", authorId: "u2", text: "omg this drop", timestamp: "10:32" },
  { id: "m2", authorId: "u1", text: "right?? turn it up", timestamp: "10:32" },
  {
    id: "m3",
    authorId: "u3",
    text: "brb grabbing snacks, don't skip",
    timestamp: "10:33"
  }
]
