// src/components/WatchTogether.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const MAX_MESSAGES = 50;
const MESSAGE_BATCH = 30;
const DISSOLVE_TIMEOUT = 60 * 1000; // 1 minute of no participants
const PRESENCE_INTERVAL = 10 * 1000; // 10 seconds heartbeat
const CLEANUP_INTERVAL = 30 * 1000; // 30 seconds check

export default function WatchTogether({ mediaId, mediaType, title }) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomCode, setRoomCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [showChat, setShowChat] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isRoomActive, setIsRoomActive] = useState(false);
  
  const chatRef = useRef(null);
  const channelRef = useRef(null);
  const cleanupTimerRef = useRef(null);
  const presenceTimerRef = useRef(null);
  const dissolveTimerRef = useRef(null);
  const isLeavingRef = useRef(false);
  
  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      isLeavingRef.current = true;
      cleanupEverything();
    };
  }, []);
  
  // Handle browser beforeunload
  useEffect(() => {
    function handleBeforeUnload() {
      isLeavingRef.current = true;
      leaveRoom();
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [roomCode]);
  
  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      const code = roomParam.toUpperCase();
      setRoomCode(code);
      setShowChat(true);
    }
  }, [searchParams]);
  
  useEffect(() => {
    if (roomCode && user) {
      setupRoom(roomCode);
      
      return () => {
        leaveRoom();
      };
    }
  }, [roomCode, user]);
  
  function cleanupEverything() {
    // Remove channel
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        console.warn('Error removing channel');
      }
      channelRef.current = null;
    }
    
    // Clear all timers
    if (cleanupTimerRef.current) {
      clearInterval(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    
    if (presenceTimerRef.current) {
      clearInterval(presenceTimerRef.current);
      presenceTimerRef.current = null;
    }
    
    if (dissolveTimerRef.current) {
      clearTimeout(dissolveTimerRef.current);
      dissolveTimerRef.current = null;
    }
    
    setIsConnected(false);
  }
  
  async function leaveRoom() {
    if (!roomCode || !user) return;
    
    try {
      // Remove self from participants
      await supabase
        .from('room_participants')
        .delete()
        .eq('room_code', roomCode)
        .eq('user_id', user.id);
      
      // Check if room is empty
      await checkAndDissolveRoom(roomCode);
    } catch (error) {
      console.warn('Failed to leave room');
    }
  }
  
  async function checkAndDissolveRoom(room) {
    try {
      // Count remaining participants
      const { data: remainingParticipants } = await supabase
        .from('room_participants')
        .select('id')
        .eq('room_code', room);
      
      if (!remainingParticipants || remainingParticipants.length === 0) {
        // No one left - dissolve the room
        await dissolveRoom(room);
      }
    } catch (error) {
      console.warn('Failed to check room');
    }
  }
  
  async function dissolveRoom(room) {
    try {
      // Delete messages first
      await supabase.from('room_messages').delete().eq('room_code', room);
      
      // Delete participants
      await supabase.from('room_participants').delete().eq('room_code', room);
      
      // Delete room
      await supabase.from('watch_rooms').delete().eq('room_code', room);
      
      // Clear local state
      setMessages([]);
      setParticipants([]);
      setIsRoomActive(false);
      setIsConnected(false);
      
      // Remove room from URL
      if (!isLeavingRef.current) {
        router.push(window.location.pathname, undefined, { shallow: true });
      }
    } catch (error) {
      console.warn('Failed to dissolve room');
    }
  }
  
  async function setupRoom(room) {
    // Check if room exists
    const { data: roomData } = await supabase
      .from('watch_rooms')
      .select('*')
      .eq('room_code', room)
      .maybeSingle();
    
    if (!roomData) {
      // Room doesn't exist - create it
      if (user) {
        await supabase.from('watch_rooms').insert({
          room_code: room,
          media_id: String(mediaId),
          media_type: mediaType,
          title: title || null,
          created_by: user.id,
          created_at: new Date().toISOString(),
        });
      }
    }
    
    setIsRoomActive(true);
    await joinRoom(room);
    setupRealtime(room);
  }
  
  function setupRealtime(room) {
    // Clean up existing channel
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        console.warn('Error removing old channel');
      }
      channelRef.current = null;
    }
    
    const channel = supabase.channel(`room:${room}`, {
      config: {
        broadcast: { self: true },
        presence: { key: user.id },
      },
    });
    
    // Set up ALL listeners BEFORE subscribing
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
        filter: `room_code=eq.${room}`,
      },
      (payload) => {
        const newMsg = payload.new;
        
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg].slice(-MAX_MESSAGES);
        });
        
        scrollToBottom();
      }
    );
    
    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'watch_rooms',
        filter: `room_code=eq.${room}`,
      },
      () => {
        setIsRoomActive(false);
        setMessages([]);
        setParticipants([]);
        setIsConnected(false);
      }
    );
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const onlineUsers = Object.keys(state).map(key => state[key][0]);
      setParticipants(onlineUsers);
      
      // Start dissolve timer if no one online
      if (onlineUsers.length === 0) {
        if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current);
        dissolveTimerRef.current = setTimeout(() => {
          checkAndDissolveRoom(room);
        }, DISSOLVE_TIMEOUT);
      } else {
        if (dissolveTimerRef.current) {
          clearTimeout(dissolveTimerRef.current);
          dissolveTimerRef.current = null;
        }
      }
    });
    
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        
        try {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        } catch (error) {
          console.warn('Failed to track presence');
        }
        
        // Heartbeat
        presenceTimerRef.current = setInterval(() => {
          if (channelRef.current && !isLeavingRef.current) {
            channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        }, PRESENCE_INTERVAL);
      }
    });
    
    channelRef.current = channel;
  }
  
  async function joinRoom(room) {
    if (!user) return;
    
    try {
      await supabase.from('room_participants').upsert({
        room_code: room,
        user_id: user.id,
        joined_at: new Date().toISOString(),
      }, { onConflict: 'room_code,user_id' });
      
      const { data } = await supabase
        .from('room_messages')
        .select('*')
        .eq('room_code', room)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_BATCH);
      
      if (data) {
        const sortedMessages = data.reverse();
        setMessages(sortedMessages);
        scrollToBottom();
      }
    } catch (error) {
      console.warn('Failed to join room');
    }
  }
  
  async function handleSendMessage(e) {
    e.preventDefault();
    if (!user || !newMessage.trim() || !roomCode || !isRoomActive) return;
    
    const messageContent = newMessage.trim();
    setNewMessage('');
    
    try {
      const { data, error } = await supabase.from('room_messages').insert({
        room_code: roomCode,
        user_id: user.id,
        content: messageContent,
        created_at: new Date().toISOString(),
      }).select().single();
      
      if (error) throw error;
      
      setMessages(prev => [...prev.slice(-MAX_MESSAGES + 1), data]);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message');
      setNewMessage(messageContent);
    }
  }
  
  function createRoom() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    setShowChat(true);
    setIsRoomActive(true);
    
    router.push(`${window.location.pathname}?room=${code}`, undefined, { shallow: true });
  }
  
  async function copyRoomLink() {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy');
    }
  }
  
  function scrollToBottom() {
    setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    }, 50);
  }
  
  function getUsername(userId) {
    if (userId === user?.id) return 'You';
    return 'User';
  }
  
  if (!isRoomActive && roomCode) {
    return (
      <div className="roomDissolved">
        <span>👥</span>
        <p>This watch room has ended.</p>
        <button onClick={createRoom}>Create New Room</button>
      </div>
    );
  }
  
  return (
    <div className="watchTogetherContainer">
      {!roomCode ? (
        <button className="watchTogetherButton" onClick={createRoom}>
          👥 Watch Together
        </button>
      ) : (
        <div className="roomPanel">
          <div className="roomHeader">
            <span className="roomCode">
              Room: <strong>{roomCode}</strong>
            </span>
            <span className={`connectionStatus ${isConnected ? 'connected' : 'connecting'}`}>
              {isConnected ? '● Live' : '○ Connecting...'}
            </span>
            <span className="participantCount">
              {participants.length} watching
            </span>
            <button className="copyButton" onClick={copyRoomLink}>
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
            <button className="toggleChat" onClick={() => setShowChat(!showChat)}>
              💬 {showChat ? 'Hide' : 'Show'} Chat
            </button>
            <button 
              className="leaveRoomButton"
              onClick={async () => {
                await leaveRoom();
                cleanupEverything();
                setRoomCode(null);
                setIsRoomActive(false);
                router.push(window.location.pathname, undefined, { shallow: true });
              }}
            >
              🚪 Leave
            </button>
          </div>
          
          {showChat && (
            <div className="chatContainer">
              <div className="chatMessages" ref={chatRef}>
                {messages.length > 0 ? (
                  messages.map((msg, index) => (
                    <div 
                      key={msg.id || index} 
                      className={`chatMessage ${msg.user_id === user?.id ? 'own' : ''}`}
                    >
                      <span className="chatUser">{getUsername(msg.user_id)}</span>
                      <p className="chatContent">{msg.content}</p>
                      <span className="chatTime">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="noMessages">No messages yet. Say hello! 👋</p>
                )}
              </div>
              
              <form onSubmit={handleSendMessage} className="chatForm">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={user ? 'Type a message...' : 'Sign in to chat'}
                  disabled={!user || !isRoomActive}
                  maxLength={500}
                />
                <button type="submit" disabled={!user || !newMessage.trim() || !isRoomActive}>
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}