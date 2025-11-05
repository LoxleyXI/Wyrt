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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-gray-900 to-blue-900 p-8">
      <div className="bg-gray-800 p-10 rounded-2xl shadow-2xl border-2 border-gray-700 max-w-lg w-full">
        <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">
          CAPTURE THE FLAG
        </h1>
        <p className="text-gray-400 text-center mb-10 text-lg">Fast-paced multiplayer CTF action</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-base font-semibold mb-3 text-gray-200">
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
              className="w-full px-5 py-4 text-lg bg-gray-900 border-2 border-gray-600 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 transition-all"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border-2 border-red-500 text-red-200 px-5 py-4 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={connecting || !name.trim()}
            className="w-full bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 text-white text-lg font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {connecting ? "Connecting..." : "Join Game"}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t-2 border-gray-700">
          <p className="text-center text-base text-gray-400">
            <strong className="text-white">WASD</strong> to move • <strong className="text-white">Space</strong> to shoot • Capture 3 flags to win
          </p>
        </div>
      </div>
    </div>
  );
}
