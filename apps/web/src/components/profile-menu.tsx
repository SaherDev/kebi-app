'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import { useLocale } from 'next-intl';
import { cn } from '@kebi-app/ui';
import { clearPersistedThread, useHomeStore } from '@/store/home-store';
import {
  Settings,
  MessageSquare,
  LogOut,
  Trash2,
} from 'lucide-react';
import { KebiAvatar } from './KebiAvatar';
import { UserCard } from './user-card';
import { ThemeSegment } from './theme-toggle';

export function ProfileMenu() {
  const t = useTranslations('profile');
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const locale = useLocale();
  const clearAllUserData = useHomeStore((s) => s.clearAllUserData);
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const menuItems = [
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    { icon: Settings, label: t('settings'), action: () => {} },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    { icon: MessageSquare, label: t('giveFeedback'), action: () => {} },
  ];

  const handleLogout = async () => {
    clearPersistedThread();
    await signOut({ redirectUrl: `/${locale}/login` });
  };

  const handleClearData = async () => {
    if (clearing) return;
    if (!window.confirm(t('clearDataConfirm'))) return;
    setClearing(true);
    try {
      await clearAllUserData();
      setOpen(false);
    } catch {
      window.alert(t('clearDataError'));
    } finally {
      setClearing(false);
    }
  };

  const displayName = user?.firstName || user?.username || 'User';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="focus:outline-none"
        suppressHydrationWarning
      >
        <KebiAvatar
          fallback={avatarInitial}
          src={user?.imageUrl}
          size="sm"
          className={cn(
            'ring-2 ring-transparent transition-all duration-200 cursor-pointer',
            open && 'ring-accent'
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute end-0 top-full mt-2 z-50 w-72 rounded-2xl border border-border bg-card shadow-kebi-app-lg overflow-hidden"
          >
            {/* Profile Header */}
            <UserCard onSetupProfile={() => router.push('/profile/setup')} />

            <div className="h-px bg-border" />

            {/* Menu Items */}
            <div className="py-2 px-2">
              {menuItems.map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  onClick={() => {
                    action();
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-foreground font-body text-sm hover:bg-muted transition-colors"
                >
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 text-start">{label}</span>
                </button>
              ))}
            </div>

            <div className="h-px bg-border" />

            {/* Theme Segment */}
            <div className="px-5 py-3">
              <ThemeSegment />
            </div>

            <div className="h-px bg-border" />

            {/* Logout & destructive actions */}
            <div className="py-2 px-2">
              <button
                onClick={handleClearData}
                disabled={clearing}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-foreground font-body text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-start">{t('clearData')}</span>
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setOpen(false);
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-foreground font-body text-sm hover:bg-muted transition-colors"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-start">{t('logOut')}</span>
              </button>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex items-center gap-4">
              <span className="font-body text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                {t('privacy')}
              </span>
              <span className="font-body text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                {t('terms')}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
