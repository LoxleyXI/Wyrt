'use client';

import { Shortcut } from '../../types/Shortcut';

interface ShortcutsProps {
  shortcuts: Shortcut[];
}

export default function Shortcuts({ shortcuts }: ShortcutsProps) {
  if (shortcuts.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
        Available Commands
      </h3>
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((shortcut, index) => (
          <div
            key={index}
            className="px-3 py-1.5 bg-white rounded-md border border-gray-300 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
            title={shortcut.description}
          >
            <span className="text-sm font-mono text-gray-700 group-hover:text-blue-600">
              {shortcut.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}