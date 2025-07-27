'use client';

import { useEffect, useContext, useState } from 'react';
import { SocketContext } from '@/contexts/SocketContext';

interface ControllerProps {
  gameId: string;
}

const Controller: React.FC<ControllerProps> = ({ gameId }) => {
  const socket = useContext(SocketContext);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  const requestPermission = async () => {
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      const permission = await (DeviceOrientationEvent as any).requestPermission();
      setHasPermission(permission === 'granted');
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  } else {
    setHasPermission(true);
  }
};

  useEffect(() => {
    socket.connect();
    socket.emit('join-game', gameId);

    requestPermission();

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta ?? 0;
      const gamma = event.gamma ?? 0;

      const maxTilt = 25;
      let tiltX = (beta / maxTilt) * 0.25;
      let tiltZ = (gamma / maxTilt) * 0.25;

      tiltX = Math.max(-0.25, Math.min(0.25, tiltX));
      tiltZ = Math.max(-0.25, Math.min(0.25, tiltZ));

      socket.emit('tilt-data', { gameId, tiltX, tiltZ });
    };

    if (hasPermission) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      socket.disconnect();
    };
  }, [gameId, hasPermission, socket]); // Add socket

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
      <p>{hasPermission ? 'Tilt your phone to control the maze!' : 'Please grant device orientation permission'}</p>
      {!hasPermission && (
        <button
          style={{
            background: 'rgba(212, 0, 255, 0.2)',
            border: '2px solid #d400ff',
            color: '#d400ff',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
          onClick={requestPermission}
        >
          Grant Permission
        </button>
      )}
    </div>
  );
};

export default Controller;