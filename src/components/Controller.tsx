'use client';
import { useEffect, useContext, useState } from 'react';
import { SocketContext } from '@/contexts/SocketContext';

interface ControllerProps {
  gameId: string;
}

const Controller: React.FC<ControllerProps> = ({ gameId }) => {
  const socket = useContext(SocketContext);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [tiltData, setTiltData] = useState<{ tiltX: number; tiltZ: number }>({ tiltX: 0, tiltZ: 0 });

  useEffect(() => {
    socket.connect();
    socket.emit('join-game', gameId);

    socket.on('connect', () => setConnectionStatus('Connected'));
    socket.on('disconnect', () => setConnectionStatus('Disconnected'));
    socket.on('joined-game', (data) => setConnectionStatus(`Joined: ${data.gameId}`));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('joined-game');
      socket.disconnect();
    };
  }, [gameId, socket]);

  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      console.log('Motion data:', {
        x: event.accelerationIncludingGravity?.x,
        y: event.accelerationIncludingGravity?.y,
        z: event.accelerationIncludingGravity?.z
      });
      const x = (event.accelerationIncludingGravity?.x ?? 0) / 9.81; // Normalize to ~[-1, 1]
      const z = (event.accelerationIncludingGravity?.y ?? 0) / 9.81; // Using y for Z tilt (adjust axes as needed)
      const maxTilt = 1;
      let tiltX = Math.max(-0.5, Math.min(0.5, x / maxTilt * 0.5));
      let tiltZ = Math.max(-0.5, Math.min(0.5, z / maxTilt * 0.5));
      setTiltData({ tiltX, tiltZ });
      socket.emit('tilt-data', { gameId, tiltX, tiltZ });
    };

    console.log('Adding devicemotion listener');
    window.addEventListener('devicemotion', handleMotion);
    return () => {
      console.log('Removing devicemotion listener');
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [gameId, socket]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#1a0033',
        color: '#d400ff',
        fontFamily: 'Orbitron, sans-serif',
        textAlign: 'center',
      }}
    >
      <h2>Neon Maze Controller</h2>
      <p>Status: {connectionStatus}</p>
      <p>Game ID: {gameId}</p>
      <p>Tilt: X={tiltData.tiltX.toFixed(2)}, Z={tiltData.tiltZ.toFixed(2)}</p>
      <p>Tilt your phone to control the maze!</p>
    </div>
  );
};

export default Controller;