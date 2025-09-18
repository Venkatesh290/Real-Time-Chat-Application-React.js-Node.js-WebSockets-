import React, { useState, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import UserList from './UserList';
import socket from '../utils/socket';

function Chat({ user, onLeave, isConnected }) {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(user.room);
  const [newRoom, setNewRoom] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    // Listen for messages
    const handleMessage = (message) => {
      setMessages(prev => [...prev, message]);
    };

    // Listen for previous messages
    const handlePreviousMessages = (previousMessages) => {
      setMessages(previousMessages);
    };

    // Listen for user list updates
    const handleUserList = (userList) => {
      setUsers(userList);
    };

    // Listen for typing indicators
    const handleUserTyping = ({ username, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) {
          return prev.includes(username) ? prev : [...prev, username];
        } else {
          return prev.filter(u => u !== username);
        }
      });

      // Clear typing indicator after 3 seconds
      if (isTyping) {
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u !== username));
        }, 3000);
      }
    };

    socket.on('message', handleMessage);
    socket.on('previousMessages', handlePreviousMessages);
    socket.on('userList', handleUserList);
    socket.on('userTyping', handleUserTyping);

    return () => {
      socket.off('message', handleMessage);
      socket.off('previousMessages', handlePreviousMessages);
      socket.off('userList', handleUserList);
      socket.off('userTyping', handleUserTyping);
    };
  }, []);

  const handleSendMessage = (message) => {
    socket.emit('sendMessage', { message, room: currentRoom });
  };

  const handleTyping = (isTyping) => {
    socket.emit('typing', { room: currentRoom, isTyping });
  };

  const handleRoomChange = () => {
    if (newRoom.trim() && newRoom.trim() !== currentRoom) {
      setCurrentRoom(newRoom.trim());
      socket.emit('switchRoom', { newRoom: newRoom.trim() });
      setNewRoom('');
      setMessages([]); // Clear messages when switching rooms
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-info">
          <h2>Chat Room: {currentRoom}</h2>
          <span className="user-info">Welcome, {user.username}!</span>
          <div className="connection-indicator">
            <span className={isConnected ? 'connected' : 'disconnected'}>
              {isConnected ? '🟢' : '🔴'}
            </span>
          </div>
        </div>
        <div className="room-controls">
          <input
            type="text"
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            placeholder="Enter new room name"
            maxLength={20}
          />
          <button onClick={handleRoomChange} disabled={!newRoom.trim()}>
            Switch Room
          </button>
          <button onClick={onLeave} className="leave-btn">
            Leave Chat
          </button>
        </div>
      </div>
      
      <div className="chat-main">
        <div className="chat-messages">
          <MessageList 
            messages={messages} 
            currentUser={user.username}
            typingUsers={typingUsers}
          />
          <MessageInput 
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            disabled={!isConnected}
          />
        </div>
        
        <UserList users={users} currentUser={user.username} />
      </div>
    </div>
  );
}

export default Chat;
