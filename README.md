# Kayro

Real-time collaborative kanban boards. Built this because I wanted something simple I could hand to a teammate and have them up in under a minute. Not Jira, not a spreadsheet, just a board that works.

**[kayro.dev](https://kayro.dev)**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

## What it does

When someone moves a card or drops a comment, it shows up for everyone on that board right away. No refresh, no polling. WebSockets.

- Create boards, add columns, drag cards between them
- Invite teammates by username or share a link
- Cards have descriptions, due dates, urgency levels, and assignees
- Comment on cards with @mentions
- Chat sidebar inside every board
- Email notifications for assignments, mentions, and board invites
- Signup, email verification, forgot password, account deletion

## How the real-time part works

Client sends a Socket.io event, server writes to MongoDB and broadcasts the full updated board back to everyone in the room. No client-side merging — everyone just gets the latest state.

```
Client A                  Server                  Client B
   │  ── card:move ──────►│                           │
   │                      │── $set columns in MongoDB │
   │                      │── board:updated ──────────►│
   │◄─ board:updated ─────│                           │
```

## Stack

**Frontend:** React, Vite, Tailwind, dnd-kit, Socket.IO client

**Backend:** Node/Express, Socket.IO, MongoDB (raw driver, no ORM)

**Email:** Resend + React Email

**Deployed:** Vercel + Render + MongoDB Atlas

## Running it locally

You need Node 18+ and MongoDB running somewhere.

```bash
git clone https://github.com/IsmaelAlGh03/rtc-kanban.git
cd rtc-kanban
npm install
cd server && npm install
cd ../client && npm install && cd ..
```

Create `server/.env`:

```
PORT=4000
MONGO_URI=mongodb://localhost:27017/kayro
CLIENT_URL=http://localhost:5173
JWT_SECRET=something_long_and_random
APP_URL=http://localhost:5173
RESEND_API_KEY=     # optional, emails just won't send without it
```

```bash
npm run dev
```

Server on `localhost:4000`, client on `localhost:5173`.

## Tests

```bash
cd server && npm test
```
