'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Heading from '@/components/Heading';
import Sidebar from '@/components/Sidebar';
import Client from '@/components/Client/Client';

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

export default function Home() {
  const [status, setStatus] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [modules, setModules] = useState<Module[]>([]);

  const handleConnect = () => {
    setStatus(true);
  };

  const handleDisconnect = () => {
    setStatus(false);
  };

  useEffect(() => {
    // Fetch available games from the server
    const fetchGames = async () => {
      try {
        // This will be handled by the WebSocket connection
        // For now, we'll fetch after connection is established
      } catch (error) {
        console.error('Failed to fetch games:', error);
      }
    };

    fetchGames();
  }, []);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar status={status} games={games} modules={modules} />
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl shadow-xl p-6 mb-6">
              <div className="flex items-center justify-center mb-6">
                <Image
                  src="/Wyrt.png"
                  alt="Wyrt Logo"
                  width={300}
                  height={100}
                  className="object-contain"
                />
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-300">
                <h3 className="font-bold text-gray-800 mb-2">Quick Start</h3>
                <div className="text-sm text-gray-700 space-y-2">
                  <p>Try these commands in the terminal below:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    <code className="bg-white px-2 py-1 rounded border border-gray-300">/help</code>
                    <code className="bg-white px-2 py-1 rounded border border-gray-300">/item iron sword</code>
                    <code className="bg-white px-2 py-1 rounded border border-gray-300">/inventory</code>
                    <code className="bg-white px-2 py-1 rounded border border-gray-300">/clear</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-6 py-3">
                <h2 className="text-lg font-bold">
                  Terminal Console
                </h2>
              </div>
              <div className="p-6">
                <Client
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onGameList={setGames}
                  onModuleList={setModules}
                />
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>© 2025 Wyrt MMO Engine - Modular Game Development Platform</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}