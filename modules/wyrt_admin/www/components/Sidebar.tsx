'use client';

import { useState, useEffect } from 'react';
import ServerStatus from './ServerStatus';

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

interface SidebarProps {
  status: boolean;
  games?: Game[];
  modules?: Module[];
}

export default function Sidebar({ status, games = [], modules = [] }: SidebarProps) {
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <aside className="w-64 bg-white shadow-xl border-r border-gray-200">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Wyrt Engine</h2>
          <ServerStatus status={status} />
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Available Games</h3>
          {games.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Connecting...</p>
          ) : (
            <nav className="space-y-1">
              {games.map((game) => (
                <a
                  key={game.name}
                  href={game.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{game.displayName}</span>
                    <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-500">Port {game.port}</span>
                </a>
              ))}
            </nav>
          )}
        </div>

        <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-gray-800 mb-2">Quick Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Players Online:</span>
              <span className="font-medium">0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Server Load:</span>
              <span className="font-medium text-green-600">Low</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Uptime:</span>
              <span className="font-medium font-mono">{formatUptime(uptime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Game Modules:</span>
              <span className="font-medium">{games.length}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-300">
          <h3 className="font-semibold text-gray-800 mb-2">Loaded Modules</h3>
          <ul className="text-xs font-mono text-gray-600 space-y-1">
            {modules.length === 0 ? (
              <li className="text-gray-400 italic">Loading...</li>
            ) : (
              modules.map((module) => (
                <li key={module.name} className="text-green-600">
                  ✓ {module.name} v{module.version}
                </li>
              ))
            )}
          </ul>
        </div>

      </div>
    </aside>
  );
}