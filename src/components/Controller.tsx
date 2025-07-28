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
      const rawX = event.accelerationIncludingGravity?.x ?? 0;
      const rawY = event.accelerationIncludingGravity?.y ?? 0;
      const rawZ = event.accelerationIncludingGravity?.z ?? 0;
      console.log('Raw motion data:', { x: rawX, y: rawY, z: rawZ });

      let tiltX = 0, tiltZ = 0;

      // Dead zone to prevent drift when flat (approx. ±1 m/s²)
      if (Math.abs(rawX) < 1 && Math.abs(rawY) < 1 && Math.abs(rawZ - 9.81) < 1) {
        tiltX = 0;
        tiltZ = 0;
      } else {
        // Map based on your observed thresholds
        if (rawX > 2 && Math.abs(rawY) < 1 && rawZ > 0) { // Left tilt (X > 0.2 scaled to ~2 m/s²)
          tiltX = -0.5; // Move left
          tiltZ = 0;
        } else if (rawX < -2 && Math.abs(rawY) < 1 && rawZ > 0) { // Right tilt (X < -0.2 scaled to ~-2 m/s²)
          tiltX = 0.5; // Move right
          tiltZ = 0;
        } else if (rawY < -1 && Math.abs(rawX) < 2) { // Forward tilt (Z < -0.1 scaled to ~-1 m/s²)
          tiltX = 0;
          tiltZ = -0.5; // Move away
        } else if (rawY > 2 && Math.abs(rawX) < 2) { // Backward tilt (Z > 0.2 scaled to ~2 m/s²)
          tiltX = 0;
          tiltZ = 0.5; // Move toward you
        }
      }

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