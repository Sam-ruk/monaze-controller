'use client';

import { useContext, useEffect, useState, useRef } from 'react';
import { SocketContext } from '@/contexts/SocketContext';

interface ControllerProps {
  playerId?: string;
}

const Controller: React.FC<ControllerProps> = ({ playerId: propPlayerId }) => {
  const socket = useContext(SocketContext);
  const [playerId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (propPlayerId) return propPlayerId.toUpperCase();
      const urlParams = new URLSearchParams(window.location.search);
      const queryId = urlParams.get('id') || urlParams.get('playerId');
      if (queryId) return queryId.toUpperCase();
    }
    return crypto.randomUUID().slice(-6).toUpperCase();
  });
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [tiltData, setTiltData] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const lastSentTime = useRef<number>(0);

  // Request device motion permission
  const requestMotionPermission = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && 'requestPermission' in DeviceMotionEvent) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        setPermissionStatus(permission);
      } catch (error) {
        console.error('Error requesting motion permission:', error);
        setPermissionStatus('error');
      }
    } else {
      setPermissionStatus('granted'); // No permission needed (e.g., Android)
    }
  };

  // Connect to socket and join game
  const connectToGame = () => {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('join', { playerId });
  };

  useEffect(() => {
    requestMotionPermission(); // Request permission on mount
    connectToGame();

    // Handle player list updates
    const handlePlayerList = (players: string[]) => {
      setTotalPlayers(players.length);
    };

    socket.on('player-list', handlePlayerList);

    return () => {
      socket.off('player-list', handlePlayerList);
      socket.disconnect();
    };
  }, [socket, playerId]);

  // Handle device motion for tilt data
  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastSentTime.current < 50) return; // Limit to ~20fps

      if (!event.accelerationIncludingGravity) return;

      const rawX = event.accelerationIncludingGravity.x || 0;
      const rawY = event.accelerationIncludingGravity.y || 0;

      const threshold = 0.1;
      const maxTilt = 0.8;
      const x = Math.abs(rawX) > threshold ? Math.max(-maxTilt, Math.min(maxTilt, rawX * 0.4)) : 0;
      const z = Math.abs(rawY) > threshold ? Math.max(-maxTilt, Math.min(maxTilt, -rawY * 0.4)) : 0;

      setTiltData({ x, z }); // Update state for UI display

      if (socket.connected) {
        lastSentTime.current = now;
        socket.emit('tilt', { x, z });
      }
    };

    if (permissionStatus === 'granted') {
      window.addEventListener('devicemotion', handleMotion);
      return () => {
        window.removeEventListener('devicemotion', handleMotion);
      };
    }
  }, [socket, permissionStatus]);

  return (
    <div>
      <h1>MONAZE</h1>
      <h3>Controller</h3>
      <p>Player ID: {playerId}</p>
      <p>Total Players: {totalPlayers}</p>
      {permissionStatus === 'granted' ? (
        <div>
          <h4>Tilt Data</h4>
          <p>Left/Right: {tiltData.x.toFixed(2)}</p>
          <p>Forward/Back: {tiltData.z.toFixed(2)}</p>
        </div>
      ) : (
        <div>
          <p>Permission: {permissionStatus}</p>
          {permissionStatus !== 'error' && (
            <button onClick={requestMotionPermission}>Request Motion Permission</button>
          )}
        </div>
      )}
    </div>
  );
};

export default Controller;