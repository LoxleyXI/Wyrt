'use client';

import { useState, useEffect, useRef } from 'react';
import { Shortcut } from '../../types/Shortcut';
import Shortcuts from './Shortcuts';

interface Game {
  name: string;
  displayName: string;
  port: number;
  url: string;
  description: string;
}

interface Module {
  name: string;
  version: string;
  description: string;
}

interface ClientProps {
  onConnect: () => void;
  onDisconnect: () => void;
  onGameList?: (games: Game[]) => void;
  onModuleList?: (modules: Module[]) => void;
}

export default function Client({ onConnect, onDisconnect, onGameList, onModuleList }: ClientProps) {
  const [status, setStatus] = useState(false);
  const [command, setCommand] = useState('');
  const [messages, setMessages] = useState<(string | { text: string; className?: string })[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const shortcuts: Shortcut[] = [
    new Shortcut('/login', '/login <username> <password>'),
    new Shortcut('/register', '/register <username> <password>'),
    new Shortcut('/move', '/move <x> <y> <z>'),
    new Shortcut('/item', '/item <Item_Name>'),
    new Shortcut('/help', 'Show available commands'),
  ];

  useEffect(() => {
    // Prevent multiple connections
    if (wsRef.current) {
      return;
    }

    // Determine WebSocket URL based on environment
    const wsUrl = typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      : 'ws://localhost:8080';

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus(true);
      onConnect();
      setMessages(prev => [...prev, '[CONNECTED] Successfully connected to Wyrt server']);

      // Request available games and modules
      ws.send(JSON.stringify({ type: 'getGames' }));
      ws.send(JSON.stringify({ type: 'getModules' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle gameList specially (unwrapped response)
        if (data.type === 'gameList') {
          if (onGameList && data.games) {
            onGameList(data.games);
            setMessages(prev => [...prev, `[SYSTEM] Loaded ${data.games.length} available game(s)`]);
          }
          return;
        }

        // Handle moduleList specially (unwrapped response)
        if (data.type === 'moduleList') {
          if (onModuleList && data.modules) {
            onModuleList(data.modules);
            setMessages(prev => [...prev, `[SYSTEM] Loaded ${data.modules.length} module(s)`]);
          }
          return;
        }

        // Handle Wyrt's wrapped message format
        if (data.type === 0 && data.msg) {
          try {
            const innerMsg = JSON.parse(data.msg);
            // Format the message nicely based on type
            if (innerMsg.type === 'error') {
              setMessages(prev => [...prev, `[ERROR] ${innerMsg.message || innerMsg.error || JSON.stringify(innerMsg)}`]);
            } else if (innerMsg.type === 'system') {
              setMessages(prev => [...prev, `[SYSTEM] ${innerMsg.message || JSON.stringify(innerMsg)}`]);
            } else if (innerMsg.type === 'chat') {
              setMessages(prev => [...prev, `[CHAT] ${innerMsg.from || 'Unknown'}: ${innerMsg.message}`]);
            } else {
              setMessages(prev => [...prev, `[MSG] ${JSON.stringify(innerMsg)}`]);
            }
          } catch (e) {
            // If inner message is not JSON, just display it
            setMessages(prev => [...prev, `[MSG] ${data.msg}`]);
          }
        } else if (data.error) {
          setMessages(prev => [...prev, `[ERROR] ${data.error}`]);
        } else if (data.message) {
          setMessages(prev => [...prev, `[SYSTEM] ${data.message}`]);
        } else {
          setMessages(prev => [...prev, `[MSG] ${JSON.stringify(data)}`]);
        }
      } catch (e) {
        // If not JSON, just display as text
        setMessages(prev => [...prev, event.data]);
      }
    };

    ws.onclose = (event) => {
      setStatus(false);
      onDisconnect();
      setMessages(prev => [...prev, `[DISCONNECTED] Connection closed (Code: ${event.code})`]);
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setMessages(prev => [...prev, '[ERROR] Connection failed - Make sure Wyrt server is running on port 8080']);
    };

    // Cleanup function
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []); // Remove dependencies to prevent reconnection

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendCommand = () => {
    if (!command || command.length === 0 || !status || !wsRef.current) {
      return;
    }

    setMessages(prev => [...prev, `> ${command}`]);

    if (command[0] === '/') {
      const args = command.slice(1).split(' ');

      if (args[0] === 'login') {
        wsRef.current.send(JSON.stringify({
          type: 'login',
          username: args[1] || 'user',
          password: args[2] || 'pass'
        }));
      } else if (args[0] === 'register') {
        wsRef.current.send(JSON.stringify({
          type: 'register',
          username: args[1] || 'user',
          password: args[2] || 'pass'
        }));
      } else if (args[0] === 'move') {
        wsRef.current.send(JSON.stringify({
          type: 'move',
          x: args[1] || '0',
          y: args[2] || '0',
          z: args[3] || '0'
        }));
      } else if (args[0] === 'clear') {
        setMessages([]);
      } else if (args[0] === 'help') {
        setMessages(prev => [...prev, 'Available commands:', ...shortcuts.map(s => `  ${s.description}`), '  /inventory - Show your inventory', '  /clear - Clear the console']);
      } else if (args[0] === 'item') {
        // Mock item command - look up item information
        const itemName = args.slice(1).join(' ');

        if (!itemName) {
          setMessages(prev => [...prev, '[ERROR] Usage: /item <item_name>']);
        } else {
          // Mock item database
          const itemDatabase: { [key: string]: { type: string; level: number; value: number; description: string } } = {
            'iron sword': { type: 'Weapon', level: 5, value: 100, description: 'A sturdy sword forged from iron ore' },
            'wooden shield': { type: 'Armor', level: 2, value: 50, description: 'Basic protection made from oak wood' },
            'health potion': { type: 'Consumable', level: 1, value: 25, description: 'Restores 50 HP when consumed' },
            'magic staff': { type: 'Weapon', level: 10, value: 500, description: 'Channels magical energy for spellcasting' },
            'leather armor': { type: 'Armor', level: 3, value: 75, description: 'Light armor made from tanned hide' },
            'gold coin': { type: 'Currency', level: 1, value: 1, description: 'Standard currency of the realm' },
            'ruby gem': { type: 'Material', level: 15, value: 1000, description: 'A precious red gemstone' },
            'ancient scroll': { type: 'Quest', level: 20, value: 0, description: 'Contains ancient knowledge and secrets' }
          };

          const item = itemDatabase[itemName.toLowerCase()];

          if (item) {
            // Determine color based on item level
            const levelColor = item.level >= 15 ? 'text-purple-400' :
                               item.level >= 10 ? 'text-yellow-400' :
                               item.level >= 5 ? 'text-blue-400' : 'text-gray-400';

            // Determine type color
            const typeColor = item.type === 'Weapon' ? 'text-red-400' :
                              item.type === 'Armor' ? 'text-cyan-400' :
                              item.type === 'Consumable' ? 'text-green-400' :
                              item.type === 'Material' ? 'text-orange-400' :
                              item.type === 'Quest' ? 'text-pink-400' : 'text-gray-400';

            setMessages(prev => [
              ...prev,
              { text: `[ITEM INFO] ${itemName}`, className: 'text-yellow-500 font-bold' },
              { text: `  Type: ${item.type}`, className: typeColor },
              { text: `  Level: ${item.level}`, className: levelColor },
              { text: `  Value: ${item.value} gold`, className: 'text-yellow-300' },
              { text: `  Description: ${item.description}`, className: 'text-gray-300 italic' }
            ]);
          } else {
            setMessages(prev => [...prev, `[ERROR] Item '${itemName}' not found in database.`]);
          }

          // Still send to server for actual processing
          wsRef.current.send(JSON.stringify({
            type: 'command',
            name: 'item',
            args: args.slice(1)
          }));
        }
      } else if (args[0] === 'inventory' || args[0] === 'inv') {
        if (inventory.length === 0) {
          setMessages(prev => [...prev, '[INVENTORY] Your inventory is empty.']);
        } else {
          setMessages(prev => [
            ...prev,
            '[INVENTORY] Your inventory contains:',
            ...inventory.map((item, index) => `  ${index + 1}. ${item}`)
          ]);
        }
      } else {
        wsRef.current.send(JSON.stringify({
          type: 'command',
          name: args[0],
          args: args.slice(1)
        }));
      }
    } else {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        message: command
      }));
    }

    setCommand('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 bg-gray-900 text-green-400 rounded-t-lg p-4 font-mono text-sm overflow-y-auto max-h-96 min-h-[200px] shadow-inner">
        {messages.length === 0 ? (
          <div className="text-gray-500 italic">Welcome to Wyrt Demo. Type /help for commands.</div>
        ) : (
          <ul className="space-y-1">
            {messages.map((msg, index) => {
              const isObject = typeof msg === 'object';
              const text = isObject ? msg.text : msg;
              const className = isObject ? msg.className : '';
              return (
                <li key={index} className={`break-words hover:bg-gray-800 px-1 rounded ${className}`}>
                  {text}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-gray-800 p-4 rounded-b-lg border-t-2 border-gray-700">
        <div className="flex items-center gap-3">
          <span className={`text-2xl animate-pulse ${status ? 'text-green-400' : 'text-red-400'}`}>
            &gt;
          </span>
          <input
            type="text"
            className="flex-1 bg-transparent border-none text-green-400 focus:outline-none text-base placeholder-gray-500 focus:placeholder-gray-400 font-mono"
            placeholder={status ? "Enter commands..." : "Connecting..."}
            aria-label="Command input"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && sendCommand()}
            disabled={!status}
          />
          <button
            onClick={sendCommand}
            disabled={!status}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors shadow-md"
          >
            Send
          </button>
        </div>
        <Shortcuts shortcuts={shortcuts} />
      </div>
    </div>
  );
}