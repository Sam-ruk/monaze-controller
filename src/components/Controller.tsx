'use client';
import { useEffect, useContext, useState } from 'react';
import { SocketContext } from '@/contexts/SocketContext';

interface ControllerProps {
  gameId: string;
}

const Controller: React.FC<ControllerProps> = ({ gameId }) => {
  const socket = useContext(SocketContext);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [tiltData, setTiltData] = useState<{tiltX: number, tiltZ: number}>({tiltX: 0, tiltZ: 0});

  const requestPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setHasPermission(true);
          console.log('Device orientation permission granted');
        } else {
          console.log('Device orientation permission denied');
        }
      } catch (error) {
        console.error('Permission request failed:', error);
      }
    } else {
      // For non-iOS devices, check if DeviceOrientationEvent is supported
      if (window.DeviceOrientationEvent) {
        setHasPermission(true);
        console.log('Device orientation supported (non-iOS)');
      } else {
        console.log('Device orientation not supported');
      }
    }
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
    if (!hasPermission) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      console.log('Raw orientation data:', {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      });

      const beta = event.beta ?? 0;   // front-to-back tilt (-180 to 180)
      const gamma = event.gamma ?? 0; // left-to-right tilt (-90 to 90)
      
      const maxTilt = 25;
      let tiltX = (beta / maxTilt) * 0.25;
      let tiltZ = (gamma / maxTilt) * 0.25;
      tiltX = Math.max(-0.25, Math.min(0.25, tiltX));
      tiltZ = Math.max(-0.25, Math.min(0.25, tiltZ));
      
      setTiltData({tiltX, tiltZ});
      console.log('Processed tilt:', {gameId, tiltX, tiltZ});
      socket.emit('tilt-data', { gameId, tiltX, tiltZ });
    };

    console.log('Adding deviceorientation listener');
    window.addEventListener('deviceorientation', handleOrientation, true);

    // Test if events are firing
    const testHandler = () => console.log('Device orientation event fired!');
    window.addEventListener('deviceorientation', testHandler, true);

    return () => {
      console.log('Removing deviceorientation listener');
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('deviceorientation', testHandler, true);
    };
  }, [hasPermission, gameId, socket]);

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
      {hasPermission && (
        <p>Tilt: X={tiltData.tiltX.toFixed(2)}, Z={tiltData.tiltZ.toFixed(2)}</p>
      )}
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