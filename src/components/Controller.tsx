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
  const targetTilt = useRef<{ tiltX: number; tiltZ: number }>({ tiltX: 0, tiltZ: 0 });

  // Custom lerp function
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

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
      if (now - lastUpdate < 100) return; // Limit to 10Hz to reduce noise
      lastUpdate = now;

      const rawX = event.accelerationIncludingGravity?.x ?? 0;
      const rawY = event.accelerationIncludingGravity?.y ?? 0;
      const rawZ = event.accelerationIncludingGravity?.z ?? 0;
      console.log('Raw motion data:', { x: rawX, y: rawY, z: rawZ });

      let targetX = 0, targetZ = 0;

      // Dead zone to filter noise (±1 m/s²)
      if (Math.abs(rawX) < 1 && Math.abs(rawY) < 1 && Math.abs(rawZ - 9.81) < 1) {
        targetX = 0;
        targetZ = 0;
      } else {
        // Low-pass filter and sensitivity adjustment
        const filteredX = lastTilt.current.tiltX * 0.7 + rawX * 0.3;
        const filteredY = lastTilt.current.tiltZ * 0.7 + rawY * 0.3;

        // Smooth transition with lower thresholds for smaller tilts
        if (filteredX > 1) { // Left tilt
          targetX = -0.5;
        } else if (filteredX < -1) { // Right tilt
          targetX = 0.5;
        }
        if (filteredY < -0.5) { // Forward tilt
          targetZ = -0.5;
        } else if (filteredY > 1) { // Backward tilt
          targetZ = 0.5;
        }
      }

      // Smooth interpolation toward target values
      const lerpFactor = 0.1; // Adjust for smoothness (0 to 1, lower = smoother)
      targetTilt.current.tiltX = lerp(targetTilt.current.tiltX, targetX, lerpFactor);
      targetTilt.current.tiltZ = lerp(targetTilt.current.tiltZ, targetZ, lerpFactor);

      lastTilt.current = { tiltX: targetTilt.current.tiltX, tiltZ: targetTilt.current.tiltZ };
      setTiltData({ tiltX: targetTilt.current.tiltX, tiltZ: targetTilt.current.tiltZ });
      socket.emit('tilt-data', { gameId, tiltX: targetTilt.current.tiltX, tiltZ: targetTilt.current.tiltZ });
    };

    // Request permission for motion sensors with type assertion
    const requestPermission = (DeviceMotionEvent as any).requestPermission;
    if (requestPermission && typeof requestPermission === 'function') {
      requestPermission.call(DeviceMotionEvent)
        .then((permissionState: string) => { // Explicitly type permissionState as string
          if (permissionState === 'granted') {
            console.log('Motion sensor permission granted');
            window.addEventListener('devicemotion', handleMotion);
          } else {
            console.log('Motion sensor permission denied');
          }
        })
        .catch(error => {
          console.error('Permission request failed:', error);
          window.addEventListener('devicemotion', handleMotion); // Fallback for non-iOS
        });
    } else {
      console.log('Permission request not supported, adding listener directly');
      window.addEventListener('devicemotion', handleMotion);
    }

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