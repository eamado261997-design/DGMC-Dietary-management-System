import React, { useState } from 'react';
import { Search } from 'lucide-react';
import SyncConflictItem from './SyncConflictItem.js';

interface Conflict {
  id: number;
  offlineData: any;
  serverData: any;
}

interface SyncConflictsProps {
  conflicts: Conflict[];
  onResolve: (id: number, action: 'merge' | 'overwrite', data?: any) => void;
}

export default function SyncConflicts({ conflicts, onResolve }: SyncConflictsProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConflicts = conflicts.filter(c => 
    JSON.stringify(c.offlineData).toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(c.serverData).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.serverData?.path && c.serverData.path.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-zinc-400" />
        <input
          type="text"
          placeholder="Search conflicts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-rose-200"
        />
      </div>
      
      <div className="space-y-4">
        {filteredConflicts.map((conflict) => (
          <SyncConflictItem key={conflict.id} conflict={conflict} onResolve={onResolve} />
        ))}
        {filteredConflicts.length === 0 && (
          <p className="text-center text-sm text-zinc-400 p-8">No conflicts matching your search.</p>
        )}
      </div>
    </div>
  );
}
