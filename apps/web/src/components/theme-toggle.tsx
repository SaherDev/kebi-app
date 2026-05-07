'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@kebi-app/ui';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => {
        const order = ['light', 'dark', 'system'] as const;
        const next = order[(order.indexOf(theme as any) + 1) % order.length];
        setTheme(next);
      }}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200',
        'bg-muted text-muted-foreground hover:bg-muted/80'
      )}
      aria-label="Toggle theme"
      suppressHydrationWarning
    >
      {theme === 'dark' ? (
        <Moon className="h-4 w-4" />
      ) : theme === 'system' ? (
        <Monitor className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}

export function ThemeSegment() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex items-center justify-between">
      <span className="font-body text-sm text-foreground">Theme</span>
      <div className="flex items-center gap-0.5 rounded-xl bg-muted p-1">
        {options.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200',
              theme === value
                ? 'bg-card text-foreground shadow-kebi-app-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={label}
            suppressHydrationWarning
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
