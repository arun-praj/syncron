// Fixture data for the call/chat overlay panels, which stay mocked in this
// pass (room/LiveKit wiring is out of scope — see docs/implementation-plan.md).

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  initials: string;
}

export const mockCurrentUser: MockUser = {
  id: "u1",
  name: "Arun",
  email: "arun@example.com",
  avatarColor: "#2563eb",
  initials: "A",
};

export const mockParticipants: MockUser[] = [
  mockCurrentUser,
  {
    id: "u2",
    name: "Priya",
    email: "priya@example.com",
    avatarColor: "#16a34a",
    initials: "P",
  },
  {
    id: "u3",
    name: "Dev",
    email: "dev@example.com",
    avatarColor: "#f59e0b",
    initials: "D",
  },
];

export interface MockMessage {
  id: string;
  authorId: string;
  text: string;
  timestamp: string;
}

export const mockMessages: MockMessage[] = [
  { id: "m1", authorId: "u2", text: "omg this drop", timestamp: "10:32" },
  { id: "m2", authorId: "u1", text: "right?? turn it up", timestamp: "10:32" },
  {
    id: "m3",
    authorId: "u3",
    text: "brb grabbing snacks, don't skip",
    timestamp: "10:33",
  },
];
