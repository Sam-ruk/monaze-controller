'use client';
import { useEffect, useContext, useState, useRef } from 'react';
import { SocketContext } from '@/contexts/SocketContext';

interface ControllerProps {
  gameId: string;
}

const Controller: React.FC<ControllerProps> = ({ gameId }) => {
  const socket = useContext(SocketContext);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [tiltData, setTiltData] = useState<{ tiltX: number; tiltZ: number }>({ tiltX: 0, tiltZ: 0 });
  const lastTilt = useRef<{ tiltX: number; tiltZ: number }>({ tiltX: 0, tiltZ: 0 });

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
    let lastUpdate = Date.now();
    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastUpdate < 100) return; // Limit updates to 10Hz to reduce noise
      lastUpdate = now;

      const rawX = event.accelerationIncludingGravity?.x ?? 0;
      const rawY = event.accelerationIncludingGravity?.y ?? 0;
      const rawZ = event.accelerationIncludingGravity?.z ?? 0;
      console.log('Raw motion data:', { x: rawX, y: rawY, z: rawZ });

      let tiltX = 0, tiltZ = 0;

      // Dead zone to filter noise (approx. ±1 m/s²)
      if (Math.abs(rawX) < 1 && Math.abs(rawY) < 1 && Math.abs(rawZ - 9.81) < 1) {
        tiltX = 0;
        tiltZ = 0;
      } else {
        // Low-pass filter to smooth data
        tiltX = lastTilt.current.tiltX * 0.7 + rawX * 0.3;
        tiltZ = lastTilt.current.tiltZ * 0.7 + rawY * 0.3; // Using Y for Z tilt

        // Discrete thresholds based on your WASD mappings
        if (tiltX > 2) { // Left tilt (A)
          tiltX = -0.5;
          tiltZ = 0;
        } else if (tiltX < -2) { // Right tilt (D)
          tiltX = 0.5;
          tiltZ = 0;
        } else if (tiltZ < -1) { // Forward tilt (W)
          tiltX = 0;
          tiltZ = -0.5;
        } else if (tiltZ > 2) { // Backward tilt (S)
          tiltX = 0;
          tiltZ = 0.5;
        } else {
          tiltX = 0;
          tiltZ = 0;
        }
      }

      lastTilt.current = { tiltX, tiltZ };
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
      <p>Tilt your phone to control the maze! (A: Left, D: Right, W: Forward, S: Backward)</p>
    </div>
  );
};

export default Controller;