'use client';
import { useEffect, useContext, useState, useRef, useCallback } from 'react';
import { SocketContext } from '@/contexts/SocketContext';

interface ControllerProps {
  playerId?: string;
}

interface TiltData {
  tiltX: number;
  tiltZ: number;
}

const Controller: React.FC<ControllerProps> = ({ playerId: propPlayerId }) => {
  const socket = useContext(SocketContext);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [tiltData, setTiltData] = useState<TiltData>({ tiltX: 0, tiltZ: 0 });
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  
  const lastTilt = useRef<TiltData>({ tiltX: 0, tiltZ: 0 });
  const targetTilt = useRef<TiltData>({ tiltX: 0, tiltZ: 0 });
const [playerId] = useState<string>(() => {
  if (typeof window !== 'undefined') {
    // Get from prop first
    if (propPlayerId) return propPlayerId.toUpperCase();
    
    // Get from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('id') || urlParams.get('playerId');
    
    if (queryId) return queryId.toUpperCase();
  }
  
  // Generate new 6-char ID if nothing found
  return crypto.randomUUID().slice(-6).toUpperCase();
});

  const calibrationRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const lastSentTime = useRef<number>(0);
  const connectionAttempts = useRef<number>(0);

  // Get playerId from URL params if not provided
  useEffect(() => {
  // Get playerId from URL path like /ABCD12 or query param
  const pathId = window.location.pathname.split('/').pop();
  const queryId = new URLSearchParams(window.location.search).get('playerId') || 
                  new URLSearchParams(window.location.search).get('id');
  
  if (propPlayerId) {
    playerId.current = propPlayerId;
  } else if (pathId && pathId.length >= 4 && pathId !== '') {
    playerId.current = pathId.toUpperCase();
  } else if (queryId) {
    playerId.current = queryId.toUpperCase();
  } else {
    // Generate new 6-char ID
    playerId.current = crypto.randomUUID().slice(-6).toUpperCase();
  }
}, [propPlayerId]);

  const lerp = (start: number, end: number, factor: number): number => {
    return start + (end - start) * factor;
  };

  const requestMotionPermission = async (): Promise<boolean> => {
    if (typeof DeviceMotionEvent !== 'undefined' && 'requestPermission' in DeviceMotionEvent) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        setPermissionStatus(permission);
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting motion permission:', error);
        setPermissionStatus('error');
        return false;
      }
    } else {
      setPermissionStatus('granted');
      return true;
    }
  };

  const calibrateDevice = useCallback(() => {
    setIsCalibrating(true);
    
    const calibrationHandler = (event: DeviceMotionEvent) => {
      if (event.accelerationIncludingGravity) {
        calibrationRef.current = {
          x: event.accelerationIncludingGravity.x || 0,
          y: event.accelerationIncludingGravity.y || 0,
          z: event.accelerationIncludingGravity.z || 0
        };
      }
      
      setTimeout(() => {
        setIsCalibrating(false);
        window.removeEventListener('devicemotion', calibrationHandler);
      }, 2000);
    };

    window.addEventListener('devicemotion', calibrationHandler);
  }, []);

  const connectToGame = useCallback(() => {
  if (!socket || connectionAttempts.current >= 3) return;
  
  connectionAttempts.current++;
  
  if (!socket.connected) {
    socket.connect();
  }
  
  // Controller only joins as controller device
  socket.emit('join-player', {
    playerId: playerId.current,
    deviceType: 'controller', // Make sure this is explicitly 'controller'
  });
}, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setConnectionStatus('Connected');
      connectionAttempts.current = 0;
      connectToGame();
    };

    const handleDisconnect = (reason: string) => {
      setConnectionStatus(`Disconnected: ${reason}`);
      if (reason === 'io server disconnect') {
        setTimeout(connectToGame, 1000);
      }
    };

    const handleJoinedPlayer = (data: { playerId: string; deviceType: string; message: string }) => {
      if (data.playerId === playerId.current && data.deviceType === 'controller') {
        setConnectionStatus(`Joined: ${data.playerId.slice(-4)}`);
      }
    };

    const handlePlayerConnected = (data: { playerId: string; deviceType: string; totalPlayers: number; hasController: boolean; hasDisplay: boolean }) => {
      setTotalPlayers(data.totalPlayers);
    };

    const handlePlayerDisconnected = (data: { playerId: string; totalPlayers: number }) => {
      setTotalPlayers(data.totalPlayers);
    };

    const handleConnectionError = (error: { message: string; code?: string }) => {
      setConnectionStatus(`Error: ${error.message}`);
    };

    const handleMultisynqReady = (data: { success: boolean; playerId: string }) => {
      if (data.playerId === playerId.current && data.success) {
        console.log('Multisynq connection established');
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('joined-player', handleJoinedPlayer);
    socket.on('player-connected', handlePlayerConnected);
    socket.on('player-disconnected', handlePlayerDisconnected);
    socket.on('connection-error', handleConnectionError);
    socket.on('multisynq-ready', handleMultisynqReady);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('joined-player', handleJoinedPlayer);
      socket.off('player-connected', handlePlayerConnected);
      socket.off('player-disconnected', handlePlayerDisconnected);
      socket.off('connection-error', handleConnectionError);
      socket.off('multisynq-ready', handleMultisynqReady);
    };
  }, [socket, connectToGame]);

  useEffect(() => {
  const handleMotion = (event: DeviceMotionEvent) => {
    const now = Date.now();
    if (now - lastSentTime.current < 50) return; // Reduce to ~20fps instead of 30fps
    
    if (!event.accelerationIncludingGravity) return;

    const rawX = (event.accelerationIncludingGravity.x || 0) - calibrationRef.current.x;
    const rawY = (event.accelerationIncludingGravity.y || 0) - calibrationRef.current.y;

    let targetX = 0;
    let targetZ = 0;

    const threshold = 0.2; // Lower threshold for better sensitivity
    const maxTilt = 1.0;

    if (Math.abs(rawX) > threshold) {
      targetX = Math.max(-maxTilt, Math.min(maxTilt, rawX * 0.5)); // Increase sensitivity
    }

    if (Math.abs(rawY) > threshold) {
      targetZ = Math.max(-maxTilt, Math.min(maxTilt, -rawY * 0.5)); // Increase sensitivity
    }

    const lerpFactor = 0.3; // Increase responsiveness
    targetTilt.current.tiltX = lerp(targetTilt.current.tiltX, targetX, lerpFactor);
    targetTilt.current.tiltZ = lerp(targetTilt.current.tiltZ, targetZ, lerpFactor);

    if (Math.abs(targetTilt.current.tiltX) < 0.02) targetTilt.current.tiltX = 0;
    if (Math.abs(targetTilt.current.tiltZ) < 0.02) targetTilt.current.tiltZ = 0;

    lastTilt.current = { ...targetTilt.current };
    setTiltData({ ...targetTilt.current });

    // Send tilt data more frequently and always send (even zeros for stopping)
    if (socket && socket.connected) {
      lastSentTime.current = now;
      socket.emit('tilt-data', {
        playerId: playerId.current,
        tiltX: targetTilt.current.tiltX,
        tiltZ: targetTilt.current.tiltZ,
        timestamp: now
      });
    }
  };

  if (permissionStatus === 'granted') {
    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }
}, [socket, permissionStatus]);

  useEffect(() => {
    requestMotionPermission();
    connectToGame();

    return () => {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    };
  }, [connectToGame]);

  const getStatusColor = () => {
    if (connectionStatus.includes('Connected') || connectionStatus.includes('Joined')) {
      return '#00ff00';
    } else if (connectionStatus.includes('Disconnected')) {
      return '#ff4444';
    } else if (connectionStatus.includes('Error')) {
      return '#ff8800';
    }
    return '#ffff00';
  };

  const getStatusMessage = () => {
  if (connectionStatus.includes('Joined')) {
    return `🎮 Controller Ready (${playerId.current.slice(-4)})`;
  }
  return connectionStatus;
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
        <h1 style={{ 
          fontSize: '2.5em', 
          margin: '0 0 20px 0',
          textShadow: '0 0 10px #d400ff',
          background: 'linear-gradient(45deg, #d400ff, #00f7ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          🌌 MONAZE
        </h1>
        
        <div style={{ marginBottom: '20px' }}>
  <h3 style={{ color: '#00f7ff', marginBottom: '10px' }}>Controller</h3>
  <p style={{ 
    color: getStatusColor(), 
    fontWeight: 'bold',
    fontSize: '1.1em',
    textShadow: `0 0 5px ${getStatusColor()}`,
  }}>
    {getStatusMessage()}
  </p>
  <p style={{ color: '#cc99ff', fontSize: '0.9em', marginTop: '5px' }}>
    Player ID: {playerId.current.slice(-4)}
  </p>
</div>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ 
            fontSize: '1.2em',
            color: '#00f7ff',
            textShadow: '0 0 5px #00f7ff',
          }}>
            🎮 Controller ready! ({totalPlayers} players online)
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#cc99ff', marginBottom: '10px' }}>Motion Permission</h4>
          <p style={{ 
            color: permissionStatus === 'granted' ? '#00ff00' : '#ff4444',
            fontWeight: 'bold',
          }}>
            {permissionStatus === 'granted' ? '✅ Granted' : 
             permissionStatus === 'denied' ? '❌ Denied' : 
             permissionStatus === 'error' ? '⚠️ Error' : '⏳ Checking...'}
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
          <>
            <button
              onClick={calibrateDevice}
              disabled={isCalibrating}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                cursor: isCalibrating ? 'not-allowed' : 'pointer',
                background: isCalibrating 
                  ? 'rgba(100, 100, 100, 0.5)' 
                  : 'linear-gradient(45deg, #00f7ff, #0080ff)',
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                margin: '10px',
                boxShadow: isCalibrating 
                  ? 'none' 
                  : '0 4px 15px rgba(0, 247, 255, 0.4)',
                opacity: isCalibrating ? 0.6 : 1,
              }}
            >
              {isCalibrating ? '📱 Calibrating...' : '🎯 Calibrate Device'}
            </button>

            <div style={{ 
              marginTop: '20px',
              padding: '15px',
              background: 'rgba(0, 247, 255, 0.1)',
              border: '1px solid #00f7ff',
              borderRadius: '10px',
            }}>
              <h4 style={{ color: '#00f7ff', marginBottom: '10px' }}>Tilt Data</h4>
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                fontSize: '0.9em',
              }}>
                <div>
                  <span style={{ color: '#cc99ff' }}>Left/Right:</span>
                  <br />
                  <span style={{ 
                    color: Math.abs(tiltData.tiltX) > 0.1 ? '#00ff00' : '#666',
                    fontWeight: 'bold',
                  }}>
                    {tiltData.tiltX.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#cc99ff' }}>Forward/Back:</span>
                  <br />
                  <span style={{ 
                    color: Math.abs(tiltData.tiltZ) > 0.1 ? '#00ff00' : '#666',
                    fontWeight: 'bold',
                  }}>
                    {tiltData.tiltZ.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {permissionStatus === 'error' && (
          <div style={{ 
            color: '#ff4444', 
            fontSize: '0.9em',
            padding: '10px',
            background: 'rgba(255, 68, 68, 0.1)',
            border: '1px solid #ff4444',
            borderRadius: '8px',
            marginTop: '10px',
          }}>
            ⚠️ Error accessing motion sensors.<br />
            Please check your browser settings and ensure you are using HTTPS.
          </div>
        )}

        <div style={{ 
          marginTop: '25px',
          fontSize: '0.85em',
          color: '#cc99ff',
          lineHeight: '1.4',
        }}>
          💡 <strong>How to play:</strong><br />
          Tilt your phone to control your glowing ball through the neon maze!<br />
          Reach the white goal to finish!
        </div>
      </div>

      {permissionStatus === 'granted' && (
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100px',
          height: '100px',
          border: '3px solid #d400ff',
          borderRadius: '50%',
          background: 'rgba(212, 0, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(212, 0, 255, 0.3)',
        }}>
          <div
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              width: '15px',
              height: '15px',
              borderRadius: '50%',
              background: getStatusColor(),
              boxShadow: `0 0 10px ${getStatusColor()}`,
            }}
          />
          <div
            style={{
              width: '25px',
              height: '25px',
              background: 'linear-gradient(45deg, #00f7ff, #d400ff)',
              borderRadius: '50%',
              transform: `translate(${tiltData.tiltX * 30}px, ${tiltData.tiltZ * 30}px)`,
              transition: 'transform 0.05s ease',
              boxShadow: '0 0 15px rgba(0, 247, 255, 0.8)',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Controller;