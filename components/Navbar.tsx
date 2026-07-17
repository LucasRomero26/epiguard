'use client';

import { Map, BarChart3, LineChart, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import AppIcon from '@/app/icon.png';

type View = 'map' | 'predictions' | 'analytics';

interface NavbarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

const TABS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'predictions', label: 'Predictions', icon: LineChart },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Navbar({ activeView, onViewChange }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 glass-nav flex items-center px-4 gap-4">
      <div className="flex items-center gap-2 min-w-[160px]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg text-cyan-500">
          <Image src={AppIcon} alt="epiguard_logo" width={32} height={32} />
        </div>
        <span className="font-bold text-base tracking-tight">
          <span className="text-cyan-500">Epi</span>Guard
        </span>
      </div>

      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-white/10">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
                activeView === id
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/10'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-[160px] flex justify-end">
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/15 hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}
      </div>
    </nav>
  );
}
