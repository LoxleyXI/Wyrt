"use client";

import { useGameStore } from "@/store/gameStore";

export default function DisconnectModal() {
  const { disconnected } = useGameStore();

  if (!disconnected) return null;

  const handleReconnect = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200]">
      <div className="bg-gray-800 border-4 border-red-600 rounded-lg p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-3xl font-bold text-red-600 mb-4">
          Disconnected
        </h2>

        <p className="text-gray-300 mb-6 text-lg">
          Connection to the server has been lost. You haven't received any updates for 30 seconds.
        </p>

        <button
          onClick={handleReconnect}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-xl"
        >
          Reconnect
        </button>

        <p className="text-gray-500 text-sm mt-4">
          Clicking Reconnect will refresh the page and return you to the login screen.
        </p>
      </div>
    </div>
  );
}
