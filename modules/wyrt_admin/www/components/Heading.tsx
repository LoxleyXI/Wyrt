'use client';

export default function Heading() {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Wyrt Demo</h1>
            <p className="text-sm opacity-90 mt-1">Modern MMO Engine Demo Application</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-75">Version 1.0.0</p>
            <p className="text-xs opacity-75">Built with Next.js & TypeScript</p>
          </div>
        </div>
      </div>
    </header>
  );
}