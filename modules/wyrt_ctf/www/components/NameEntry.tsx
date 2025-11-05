"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { getSocket } from "@/lib/ctfSocket";

export default function NameEntry() {
  const [name, setName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setPlayerName, setConnected } = useGameStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const socket = getSocket();

      // Connect to WebSocket server
      await socket.connect();

      // Set connected state
      setConnected(true);

      // Set player name (this will trigger the game to load)
      setPlayerName(name.trim());

      // Enter game will be called from the Game component
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Failed to connect to game server. Please try again.");
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-8">
      <div className="bg-gray-800 p-10 rounded-lg shadow-xl border border-gray-700 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-2 text-white">
          CAPTURE THE FLAG
        </h1>
        <p className="text-gray-400 text-center mb-8">Fast-paced multiplayer CTF action</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2 text-gray-300">
              Enter Your Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player123"
              maxLength={20}
              disabled={connecting}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={connecting || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-md transition-colors disabled:cursor-not-allowed"
          >
            {connecting ? "Connecting..." : "Join Game"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-700">
          <p className="text-center text-sm text-gray-400">
            <span className="text-gray-200">WASD</span> to move • <span className="text-gray-200">Space</span> to shoot
          </p>
          <p className="text-center text-xs text-gray-500 mt-2">
            Capture 3 flags to win
          </p>
        </div>
      </div>
    </div>
  );
}
