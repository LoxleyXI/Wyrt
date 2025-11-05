'use client';

interface ServerStatusProps {
  status: boolean;
}

export default function ServerStatus({ status }: ServerStatusProps) {
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${status ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
      <span className="text-sm font-medium text-gray-700">
        {status ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}