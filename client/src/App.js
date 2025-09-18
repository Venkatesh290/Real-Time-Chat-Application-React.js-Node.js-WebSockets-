import React, { useState, useEffect } from 'react';
import Chat from './components/Chat';
import socket from './utils/socket';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check connection status
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Check initial connection state
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  const handleJoin = (username, room) => {
    const userData = { username, room };
    setUser(userData);
    socket.emit('join', userData);
  };

  const handleLeave = () => {
    setUser(null);
    socket.disconnect();
    socket.connect();
  };

  if (!user) {
    return <LoginForm onJoin={handleJoin} isConnected={isConnected} />;
  }

  return (
    <div className="App">
      <Chat 
        user={user} 
        onLeave={handleLeave} 
        isConnected={isConnected}
      />
    </div>
  );
}

// Login Form Component
function LoginForm({ onJoin, isConnected }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('general');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && isConnected) {
      onJoin(username.trim(), room.trim());
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h1>Join Chat</h1>
        <div className="connection-status">
          Status: <span className={isConnected ? 'connected' : 'disconnected'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              maxLength={20}
            />
          </div>
          <div className="form-group">
            <label htmlFor="room">Room:</label>
            <input
              id="room"
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Enter room name"
              required
              maxLength={20}
            />
          </div>
          <button 
            type="submit" 
            disabled={!username.trim() || !isConnected}
            className="join-btn"
          >
            Join Chat
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
