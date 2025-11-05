"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "@/store/gameStore";

// Dynamically import components to avoid SSR issues
const NameEntry = dynamic(() => import("@/components/NameEntry"), { ssr: false });
const Game = dynamic(() => import("@/components/Game"), { ssr: false });

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { playerName, gameState } = useGameStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until client-side
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400 text-xl">Loading CTF...</div>
      </div>
    );
  }

  // Show name entry if player hasn't entered name
  if (!playerName) {
    return <NameEntry />;
  }

  // Show game once player has entered name
  return <Game />;
}
