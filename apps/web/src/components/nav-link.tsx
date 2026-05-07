'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@kebi-app/ui';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
}

export function NavLink({
  href,
  children,
  className,
  activeClassName = 'text-foreground font-semibold',
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        'text-muted-foreground hover:text-foreground transition-colors',
        className,
        isActive && activeClassName
      )}
    >
      {children}
    </Link>
  );
}
