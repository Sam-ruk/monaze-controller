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
      setPermissionStatus('granted');
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
    requestMotionPermission();
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

      setTiltData({ x, z });

      if (socket.connected) {
        lastSentTime.current = now;
        socket.emit('tilt', { playerId, x, z });
      }
    };

    if (permissionStatus === 'granted') {
      window.addEventListener('devicemotion', handleMotion);
      return () => {
        window.removeEventListener('devicemotion', handleMotion);
      };
    }
  }, [socket, permissionStatus]);

  // Status color for connection indicator
  const getStatusColor = () => {
    return socket.connected ? '#00ff00' : '#ff4444';
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a0033 0%, #330066 50%, #1a0033 100%)',
        color: '#d400ff',
        fontFamily: 'Orbitron, monospace',
        textAlign: 'center',
        padding: '20px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: 'rgba(212, 0, 255, 0.1)',
          border: '2px solid #d400ff',
          borderRadius: '15px',
          padding: '30px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 0 30px rgba(212, 0, 255, 0.3)',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontSize: '2.5em',
            margin: '0 0 20px 0',
            textShadow: '0 0 10px #d400ff',
            background: 'linear-gradient(45deg, #d400ff, #00f7ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          MONAZE
        </h1>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#00f7ff', marginBottom: '10px' }}>Controller</h3>
          <p
            style={{
              color: getStatusColor(),
              fontWeight: 'bold',
              fontSize: '1.1em',
              textShadow: `0 0 5px ${getStatusColor()}`,
            }}
          >
            {socket.connected ? `🎮 Controller Ready (${playerId.slice(-4)})` : 'Disconnected'}
          </p>
          <p style={{ color: '#cc99ff', fontSize: '0.9em', marginTop: '5px' }}>
            Player ID: {playerId.slice(-4)}
          </p>
          <p
            style={{
              fontSize: '1.2em',
              color: '#00f7ff',
              textShadow: '0 0 5px #00f7ff',
            }}
          >
            Players Online: {totalPlayers}
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#cc99ff', marginBottom: '10px' }}>Motion Permission</h4>
          <p
            style={{
              color: permissionStatus === 'granted' ? '#00ff00' : '#ff4444',
              fontWeight: 'bold',
            }}
          >
            {permissionStatus === 'granted'
              ? '✅ Granted'
              : permissionStatus === 'denied'
              ? '❌ Denied'
              : permissionStatus === 'error'
              ? '⚠️ Error'
              : '⏳ Checking...'}
          </p>
        </div>

        {permissionStatus === 'denied' && (
          <button
            onClick={requestMotionPermission}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              background: 'linear-gradient(45deg, #d400ff, #ff0080)',
              color: '#fff',
              border: 'none',
              borderRadius: '25px',
              margin: '10px',
              boxShadow: '0 4px 15px rgba(212, 0, 255, 0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Request Permission
          </button>
        )}

        {permissionStatus === 'granted' && (
          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              background: 'rgba(0, 247, 255, 0.1)',
              border: '1px solid #00f7ff',
              borderRadius: '10px',
            }}
          >
            <h4 style={{ color: '#00f7ff', marginBottom: '10px' }}>Tilt Data</h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                fontSize: '0.9em',
              }}
            >
              <div>
                <span style={{ color: '#cc99ff' }}>Left/Right:</span>
                <br />
                <span
                  style={{
                    color: Math.abs(tiltData.x) > 0.1 ? '#00ff00' : '#666',
                    fontWeight: 'bold',
                  }}
                >
                  {tiltData.x.toFixed(2)}
                </span>
              </div>
              <div>
                <span style={{ color: '#cc99ff' }}>Forward/Back:</span>
                <br />
                <span
                  style={{
                    color: Math.abs(tiltData.z) > 0.1 ? '#00ff00' : '#666',
                    fontWeight: 'bold',
                  }}
                >
                  {tiltData.z.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {permissionStatus === 'error' && (
          <div
            style={{
              color: '#ff4444',
              fontSize: '0.9em',
              padding: '10px',
              background: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid #ff4444',
              borderRadius: '8px',
              marginTop: '10px',
            }}
          >
            ⚠️ Error accessing motion sensors.<br />
            Please check your browser settings and ensure you are using HTTPS.
          </div>
        )}
      </div>
    </div>
  );
};

export default Controller;