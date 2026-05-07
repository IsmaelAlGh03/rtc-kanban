# RTC Kanban

A real-time collaborative Kanban board where changes made by any user — moving cards, adding columns, posting comments — are instantly reflected for everyone in the same board session.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

## Features

- **Real-time sync** — board state propagates to all connected clients via WebSocket events
- **Authentication** — JWT-based auth with bcrypt password hashing; login by username or email
- **Board management** — create and delete boards; each board is isolated to its own Socket.io room
- **Columns & cards** — add, move, and delete cards across columns; add and delete columns
- **Card metadata** — per-card assignee, urgency level, and comment thread
- **Ephemeral chat** — live in-board chat that persists for the session

## How Real-Time Works

Clients emit Socket.io events (`card:move`, `card:add`, `column:add`, etc.) to the server. The server applies the mutation directly to the MongoDB document using `$set` on the full `columns` array, then broadcasts a `board:updated` event carrying the complete updated board to every socket in the room. Clients replace their local state with the received document — there is no client-side merging or conflict resolution.

```
Client A                  Server                  Client B
   │  ── card:move ──────►│                           │
   │                      │── $set columns in MongoDB │
   │                      │── board:updated ──────────►│
   │◄─ board:updated ─────│                           │
```

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend  | Node.js, Express, TypeScript      |
| Realtime | Socket.io                         |
| Database | MongoDB (Atlas), raw driver (no ODM) |
| Auth     | JWT, bcryptjs                     |
