"use client";

import { useGameStore } from "@/store/gameStore";

export default function GameUI() {
  const { gameState, myPlayer } = useGameStore();

  if (!gameState || !myPlayer) {
    return (
      <div className="absolute top-0 left-0 right-0 p-8 text-center text-white">
        <div className="bg-gray-900/90 inline-block px-8 py-6 rounded-lg border-2 border-gray-600">
          <div className="text-2xl font-bold">Loading game...</div>
        </div>
      </div>
    );
  }

  const { scores, status, captureLimit, winnerId } = gameState;
  const myTeam = myPlayer.team;
  const enemyTeam = myTeam === "red" ? "blue" : "red";

  return (
    <>
      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none z-10 gap-4">
        {/* Red Team Score */}
        <div className={`bg-red-900/90 px-8 py-5 rounded-xl border-2 shadow-xl ${myTeam === "red" ? "border-yellow-400 shadow-yellow-400/20" : "border-red-700"} min-w-[180px]`}>
          <div className="text-red-200 text-sm font-bold text-center mb-2">RED TEAM</div>
          <div className="text-white text-5xl font-bold text-center">{scores.red}</div>
          <div className="text-red-300 text-sm text-center mt-2">/ {captureLimit}</div>
        </div>

        {/* Center Status */}
        <div className="bg-gray-900/95 px-10 py-5 rounded-xl border-2 border-gray-600 shadow-xl flex-1 max-w-md mx-auto">
          {status === "waiting" && (
            <div className="text-yellow-400 font-bold text-lg text-center animate-pulse">
              Waiting for players...
            </div>
          )}
          {status === "playing" && (
            <div className="text-green-400 font-bold text-lg text-center">
              MATCH IN PROGRESS
            </div>
          )}
          {status === "ended" && winnerId && (
            <div className={`font-bold text-3xl text-center animate-pulse ${winnerId === "red" ? "text-red-400" : "text-blue-400"}`}>
              {winnerId.toUpperCase()} TEAM WINS!
            </div>
          )}
        </div>

        {/* Blue Team Score */}
        <div className={`bg-blue-900/90 px-8 py-5 rounded-xl border-2 shadow-xl ${myTeam === "blue" ? "border-yellow-400 shadow-yellow-400/20" : "border-blue-700"} min-w-[180px]`}>
          <div className="text-blue-200 text-sm font-bold text-center mb-2">BLUE TEAM</div>
          <div className="text-white text-5xl font-bold text-center">{scores.blue}</div>
          <div className="text-blue-300 text-sm text-center mt-2">/ {captureLimit}</div>
        </div>
      </div>

      {/* Bottom HUD - Player Info */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none z-10">
        <div className="flex justify-center">
          <div className={`bg-gray-900/95 px-8 py-6 rounded-xl border-2 shadow-xl ${myTeam === "red" ? "border-red-500 shadow-red-500/20" : "border-blue-500 shadow-blue-500/20"}`}>
            {/* Player Name and Team */}
            <div className="flex items-center gap-6">
              <div className="min-w-[140px]">
                <div className="text-gray-400 text-xs font-semibold mb-1">YOU</div>
                <div className="text-white font-bold text-xl mb-1">{myPlayer.name}</div>
                <div className={`text-sm font-bold ${myTeam === "red" ? "text-red-400" : "text-blue-400"}`}>
                  {myTeam.toUpperCase()} TEAM
                </div>
              </div>

              {/* Weapon/Item */}
              {myPlayer.weapon && (
                <div className="px-6 border-l-2 border-gray-700">
                  <div className="text-gray-400 text-xs font-semibold mb-1">WEAPON</div>
                  <div className="text-white font-bold text-base capitalize">
                    {myPlayer.weapon === 'stun_gun' ? 'Scatter Gun' : myPlayer.weapon.replace('_', ' ')}
                  </div>
                  <div className="text-yellow-400 text-base font-bold">x{myPlayer.weaponCharges}</div>
                </div>
              )}

              {/* Status Effects */}
              {myPlayer.stunned && (
                <div className="px-6 border-l-2 border-gray-700">
                  <div className="text-red-400 font-bold text-base">STUNNED</div>
                </div>
              )}

              {myPlayer.activeBoost && (
                <div className="px-6 border-l-2 border-gray-700">
                  <div className="text-green-400 font-bold text-base">
                    {myPlayer.activeBoost === 'speed' ? 'SPEED BOOST' : 'SHIELD'}
                  </div>
                </div>
              )}

              {myPlayer.carryingFlag && (
                <div className="px-6 border-l-2 border-gray-700">
                  <div className={`font-bold text-base ${enemyTeam === "red" ? "text-red-400" : "text-blue-400"}`}>
                    CARRYING {enemyTeam.toUpperCase()} FLAG
                  </div>
                </div>
              )}
            </div>

            {/* Controls Hint */}
            <div className="mt-4 pt-4 border-t-2 border-gray-700 text-sm text-gray-400 flex gap-6 justify-center">
              <span className="font-medium">WASD: Move</span>
              <span className="font-medium">Space: Shoot</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
