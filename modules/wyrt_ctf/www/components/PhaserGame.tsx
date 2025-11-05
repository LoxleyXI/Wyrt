"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import GameScene from "@/scenes/GameScene";
import BootScene from "@/scenes/BootScene";

export default function PhaserGame() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 800,
      height: 592, // 37 tiles * 16 pixels
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [BootScene, GameScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      pixelArt: false, // Disable for smooth text rendering
      antialias: true,
      antialiasGL: true,
      backgroundColor: "#2a2a2a",
      render: {
        antialiasGL: true,
        pixelArt: false,
      },
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: '800px',
        height: '592px',
        zIndex: 1
      }}
    />
  );
}
