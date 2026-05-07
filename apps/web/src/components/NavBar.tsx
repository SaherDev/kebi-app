import { cn } from "@kebi-app/ui";

interface NavBarProps {
  className?: string;
  children?: React.ReactNode;
}

function NavBar({ className, children }: NavBarProps) {
  return (
    <nav
      className={cn(
        "sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border/50 md:px-6",
        className
      )}
    >
      {children}
    </nav>
  );
}

function NavBarLogo() {
  return (
    <div className="flex items-center gap-2">
      <span className="font-display text-xl text-foreground">Kebi</span>
    </div>
  );
}

function NavBarActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3">{children}</div>;
}

export { NavBar, NavBarLogo, NavBarActions };
