import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    const token = localStorage.getItem('rtc-token') ?? '';
    _socket = io('http://localhost:4000', { auth: { token } });
  }
  return _socket;
}

export function resetSocket(): void {
  _socket?.disconnect();
  _socket = null;
}
