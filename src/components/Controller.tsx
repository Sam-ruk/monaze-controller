'use client';
import { useEffect, useContext, useState, useRef } from 'react';
import { SocketContext } from '@/contexts/SocketContext';

// Define interface for Controller props
interface ControllerProps {
  gameId: string;
}

// Define interface for tilt data
interface TiltData {
  tiltX: number;
  tiltZ: number;
  lastUpdate?: number;
}

// Extend DeviceMotionEvent to include requestPermission for TypeScript
interface DeviceMotionEventWithPermission extends DeviceMotionEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

// Type guard to check if DeviceMotionEvent has requestPermission
const hasRequestPermission = (obj: any): obj is DeviceMotionEventWithPermission => {
  return 'requestPermission' in obj && typeof obj.requestPermission === 'function';
};

const Controller: React.FC<ControllerProps> = ({ gameId }) => {
  const socket = useContext(SocketContext);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [tiltData, setTiltData] = useState<TiltData>({ tiltX: 0, tiltZ: 0 });
  const lastTilt = useRef<TiltData>({ tiltX: 0, tiltZ: 0 });
  const targetTilt = useRef<TiltData>({ tiltX: 0, tiltZ: 0 });

  // Custom lerp function
  const lerp = (start: number, end: number, factor: number): number => {
    return start + (end - start) * factor;
  };

  // Handle device motion
  const handleMotion = (event: DeviceMotionEvent) => {
    const now = Date.now();
    const lastUpdate = lastTilt.current.lastUpdate || Date.now();
    if (now - lastUpdate < 100) return; // Limit to 10Hz to reduce noise
    lastTilt.current.lastUpdate = now;

    const rawX = event.accelerationIncludingGravity?.x ?? 0;
    const rawY = event.accelerationIncludingGravity?.y ?? 0;
    const rawZ = event.accelerationIncludingGravity?.z ?? 0;
    console.log('Raw motion data:', { x: rawX, y: rawY, z: rawZ });

    let targetX = 0,
      targetZ = 0;

    // Dead zone to filter noise (±1 m/s²)
    if (Math.abs(rawX) < 1 && Math.abs(rawY) < 1 && Math.abs(rawZ - 9.81) < 1) {
      targetX = 0;
      targetZ = 0;
    } else {
      // Low-pass filter and sensitivity adjustment
      const filteredX = lastTilt.current.tiltX * 0.7 + rawX * 0.3;
      const filteredY = lastTilt.current.tiltZ * 0.7 + rawY * 0.3;

      // Smooth transition with lower thresholds for smaller tilts
      if (filteredX > 1) {
        // Left tilt (A)
        targetX = -0.5;
      } else if (filteredX < -1) {
        // Right tilt (D)
        targetX = 0.5;
      }
      if (filteredY < -0.5) {
        // Forward tilt (W)
        targetZ = -0.5;
      } else if (filteredY > 1) {
        // Backward tilt (S)
        targetZ = 0.5;
      }
    }

    // Smooth interpolation toward target values
    const lerpFactor = 0.1; // Adjust for smoothness (0 to 1, lower = smoother)
    targetTilt.current.tiltX = lerp(targetTilt.current.tiltX, targetX, lerpFactor);
    targetTilt.current.tiltZ = lerp(targetTilt.current.tiltZ, targetZ, lerpFactor);

    lastTilt.current = { tiltX: targetTilt.current.tiltX, tiltZ: targetTilt.current.tiltZ, lastUpdate: now };
    setTiltData({ tiltX: targetTilt.current.tiltX, tiltZ: targetTilt.current.tiltZ });
    socket.emit('tilt-data', { gameId, tiltX: targetTilt.current.tiltX, tiltZ: targetTilt.current.tiltZ });
  };

  // Request motion permission
  const requestMotionPermission = async () => {
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      hasRequestPermission(DeviceMotionEvent)
    ) {
      try {
        const permission = await DeviceMotionEvent.requestPermission!();
        if (permission === 'granted') {
          setConnectionStatus('Connected (Motion permission granted)');
          console.log('Adding devicemotion listener after permission granted');
          window.addEventListener('devicemotion', handleMotion);
        } else {
          setConnectionStatus('Motion permission denied. Please enable motion sensors in your browser settings.');
        }
      } catch (error) {
        console.error('Error requesting motion permission:', error);
        setConnectionStatus('Error accessing motion sensors. Please check browser settings.');
      }
    } else {
      // Fallback for browsers that don't require explicit permission
      setConnectionStatus('Connected (No permission required)');
      console.log('Adding devicemotion listener (no permission required)');
      window.addEventListener('devicemotion', handleMotion);
    }
  };

  useEffect(() => {
    // Connect socket and handle events
    socket.connect();
    socket.emit('join-game', gameId);

    socket.on('connect', () => setConnectionStatus('Connected'));
    socket.on('disconnect', () => setConnectionStatus('Disconnected'));
    socket.on('joined-game', (data: { gameId: string }) =>
      setConnectionStatus(`Joined: ${data.gameId}`)
    );

    // Initialize motion listener
    console.log('Initializing motion listener');
    requestMotionPermission();

    // Cleanup
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('joined-game');
      socket.disconnect();
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
      {connectionStatus.includes('denied') && (
        <button
          onClick={() => requestMotionPermission()}
          style={{
            padding: '10px',
            fontSize: '16px',
            cursor: 'pointer',
            background: '#d400ff',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
          }}
        >
          Request Motion Permission
        </button>
      )}
      <p>Tilt: X={tiltData.tiltX.toFixed(2)}, Z={tiltData.tiltZ.toFixed(2)}</p>
      <p>Tilt your phone to control the maze!</p>
    </div>
  );
};

export default Controller;