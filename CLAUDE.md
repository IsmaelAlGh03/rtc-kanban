# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development (run from repo root)
```bash
npm run dev          # Start both server and client concurrently
npm run dev:server   # Server only (nodemon + ts-node, port 4000)
npm run dev:client   # Client only (Vite, port 5173)
```

### Server (from `server/`)
```bash
npm run build   # tsc → dist/
npm start       # node dist/index.js (production)
```

### Client (from `client/`)
```bash
npm run build   # tsc -b && vite build
npm run lint    # eslint
npm run preview # Preview production build
```

## Environment

Server reads from a `.env` file in `server/`:
- `PORT` — defaults to `4000`
- `MONGO_URI` — defaults to `mongodb://localhost:27017/rtc-kanban`
- `CLIENT_URL` — defaults to `http://localhost:5173` (used for CORS)

MongoDB must be running locally (or `MONGO_URI` set) before starting the server.

## Architecture

This is a real-time Kanban board with a TypeScript Express/Socket.io backend and a React/TypeScript frontend.

### Server (`server/src/`)

- **`index.ts`** — entry point; wires Express, Socket.io (with CORS), MongoDB, routes, and socket handlers together
- **`db.ts`** — singleton MongoDB connection; `connectDB(uri)` initialises it, `getDB()` returns the `Db` instance
- **`models/Board.ts`** — TypeScript interfaces only (`IBoard`, `IColumn`, `ICard`); no ODM/ORM — raw MongoDB driver is used throughout
- **`routes/boards.ts`** — REST API at `/api/boards`: `GET /`, `GET /:id`, `POST /` (creates board with default To Do/In Progress/Done columns), `DELETE /:id`
- **`socket/handlers.ts`** — all real-time logic; registers handlers on every `connection` event

### Real-time flow

Clients emit Socket.io events; the server mutates the in-memory board document, persists the full `columns` array with `$set`, then broadcasts `board:updated` with the complete updated board to all sockets in the room.

**Socket events (client → server):**
| Event | Payload |
|---|---|
| `board:join` | `boardId` |
| `card:move` | `{ boardId, cardId, fromColumnId, toColumnId, toIndex }` |
| `card:add` | `{ boardId, columnId, title }` |
| `card:delete` | `{ boardId, columnId, cardId }` |
| `column:add` | `{ boardId, title }` |
| `column:delete` | `{ boardId, columnId }` |

**Server → client:** `board:updated` with the full `IBoard` document after any mutation.

### Data model

Boards are stored as a single document in the `boards` collection. Columns and cards are embedded arrays — there are no separate collections. `_id` fields on columns and cards are `ObjectId().toString()` strings, not ObjectIds.

### Client (`client/src/`)

Currently a default Vite + React scaffold (`App.tsx`). The `socket.io-client` dependency is installed and ready to use.
