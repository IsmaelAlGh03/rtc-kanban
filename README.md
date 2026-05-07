# RTC Kanban

A real-time Kanban board built to put my experience with WebSockets and live data sync to use in a full-stack project. Move a card, add a column, drop a comment — everyone in the same board sees it instantly, no refresh needed.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

## What it does

- **Real-time updates** — any change is pushed to all connected users immediately via Socket.io
- **Auth** — register/login with JWT tokens and bcrypt-hashed passwords; you can use your username or email to log in
- **Boards** — create and delete boards; each one runs in its own Socket.io room
- **Columns & cards** — add, move, and delete cards across columns; add and delete columns
- **Card details** — assign cards to people, set an urgency level, and leave comments
- **Live chat** — a simple chat that's active while you're in the board

## How the real-time part works

When an action is performed (moving a card, adding a column, etc.), the client sends a Socket.io event to the server. The server updates the board in MongoDB, then broadcasts the full updated board back to everyone in the room. No merging on the client side — everyone just gets the latest version.

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
