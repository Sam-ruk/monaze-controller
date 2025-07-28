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
  const [permissionStatus, setPermissionStatus] = useState<string>('Not Requested');
  const lastUpdateRef = useRef<number>(Date.now());

  // Custom lerp function
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  // Handle motion events
  const handleMotion = (event: DeviceMotionEvent) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < 100) return; // Limit to 10Hz to reduce noise
    lastUpdateRef.current = now;

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
      const filteredX = lastTilt.current.tiltX * 0.7 + rawX * 0.3;
      const filteredY = lastTilt.current.tiltZ * 0.7 + rawY * 0.3;

      if (filteredX > 1) targetX = -0.5; // Left tilt
      else if (filteredX < -1) targetX = 0.5; // Right tilt
      if (filteredY < -0.5) targetZ = -0.5; // Forward tilt
      else if (filteredY > 1) targetZ = 0.5; // Backward tilt
    }

    const lerpFactor = 0.1;
    targetTilt.current.tiltX = lerp(targetTilt.current.tiltX, targetX, lerpFactor);
    targetTilt.current.tiltZ = lerp(targetTilt.current.tiltZ, targetZ, lerpFactor);

    lastTilt.current = { tiltX: targetTilt.current.tiltX, tiltZ: targetTilt.current.tiltZ };
    setTiltData({ tiltX: targetTilt.current.tiltX, tiltZ: targetTilt.current.tiltZ });
    socket.emit('tilt-data', { gameId, tiltX: targetTilt.current.tiltX, tiltZ: targetTilt.current.tiltZ });
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

  const requestMotionPermission = () => {
    setPermissionStatus('Requesting...');
    const requestPermission = (DeviceMotionEvent as any).requestPermission;
    if (requestPermission && typeof requestPermission === 'function') {
      requestPermission.call(DeviceMotionEvent)
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            console.log('Motion sensor permission granted');
            setPermissionStatus('Granted');
            window.addEventListener('devicemotion', handleMotion);
          } else {
            console.log('Motion sensor permission denied');
            setPermissionStatus('Denied');
          }
        })
        .catch((error: unknown) => {
          console.error('Permission request failed:', error);
          setPermissionStatus('Failed');
          // Fallback for non-iOS or failed request
          if (navigator.permissions) {
            navigator.permissions.query({ name: 'accelerometer' }).then((permissionStatus) => {
              if (permissionStatus.state === 'granted') {
                console.log('Accelerometer permission already granted via settings');
                setPermissionStatus('Granted');
                window.addEventListener('devicemotion', handleMotion);
              } else {
                setPermissionStatus('Blocked - Enable in Browser Settings');
                console.log('Motion sensors blocked, please enable in browser settings');
              }
            });
          } else {
            setPermissionStatus('Blocked - Enable in Browser Settings');
            console.log('Permissions API not supported, enable in browser settings');
            window.addEventListener('devicemotion', handleMotion); // Last resort
          }
        });
    } else {
      setPermissionStatus('Granted (No Prompt Needed)');
      console.log('Permission request not supported, adding listener directly');
      window.addEventListener('devicemotion', handleMotion);
    }
  };

  useEffect(() => {
    requestMotionPermission();
    return () => {
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
      <p>Permission Status: {permissionStatus}</p>
      {permissionStatus === 'Not Requested' || permissionStatus === 'Denied' || permissionStatus === 'Failed' || permissionStatus === 'Blocked - Enable in Browser Settings' ? (
        <button
          onClick={requestMotionPermission}
          style={{
            marginTop: '10px',
            padding: '10px 20px',
            background: '#d400ff',
            color: '#1a0033',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontFamily: 'Orbitron, sans-serif',
          }}
        >
          Grant Motion Sensor Permission
        </button>
      ) : null}
    </div>
  );
};

export default Controller;