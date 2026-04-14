import React from 'react';
import { SidebarModeSwitch } from './SidebarModeSwitch';
import { CollectionTree } from '../http/CollectionTree';
import { DevToolsSidebar } from '../devtools/DevToolsSidebar';

interface SidebarProps {
  mode: 'http' | 'devtools';
  onModeChange: (mode: 'http' | 'devtools') => void;
  exportCollection?: any;
  importCollection?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ mode, onModeChange, exportCollection, importCollection }) => {
  return (
    <div className="sidebar">
      <SidebarModeSwitch mode={mode} onChange={onModeChange} />
      {mode === 'http' && <CollectionTree exportCollection={exportCollection} importCollection={importCollection} />}
      {mode === 'devtools' && <DevToolsSidebar />}
    </div>
  );
};
