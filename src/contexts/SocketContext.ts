"use client";
import { createContext } from 'react';
import io, { Socket } from 'socket.io-client';

interface SocketEvents {
  join: (data: { playerId: string }) => void;
  tilt: (data: { playerId: string, x: number; z: number }) => void;
  'player-list': (players: string[]) => void;
}

export const socket: Socket<SocketEvents> = io('https://samkdev.xyz', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  timeout: 20000,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

export const SocketContext = createContext(socket);